#!/usr/bin/env node
/**
 * Fetch tweets for a user handle via UserTweets GraphQL.
 *
 * Usage:
 *   node twitter-user.js --user narendramodi
 *   node twitter-user.js --user narendramodi --pages 5
 *   node twitter-user.js                         # uses USER / HANDLE from .env
 */

const fs = require("fs");
const path = require("path");
const {
  loadEnvFile,
  loadAuth,
  warmSession,
  createTxGenerator,
  graphqlGetWithRetry,
  TIMELINE_FEATURES,
  sleep,
} = require("./twitter-client");
const { parseTimeline, extractCursors } = require("./tweetparsor");

loadEnvFile(path.join(__dirname, ".env"));

// From your browser curl (UserTweets)
const USER_TWEETS_ID = "6r5OLCC_wFH4CpRyXKuAmQ";
const USER_TWEETS_PATH = `/i/api/graphql/${USER_TWEETS_ID}/UserTweets`;

// Resolve @handle → userId
const USER_BY_SCREEN_IDS = [
  "G3KCR-EjJbm_J3HFBknVuA",
  "sLVLrk0lue1HLwIopNJF2Q",
  "NimuplG1OB7Fd2btCLdBOw",
  "qW5u-D1jlYKmB-ihCjJL_A",
];

const USER_FEATURES = {
  ...TIMELINE_FEATURES,
  hidden_profile_subscriptions_enabled: true,
  responsive_web_twitter_article_notes_tab_enabled: false,
  subscriptions_verification_info_is_identity_verified_enabled: true,
  subscriptions_verification_info_verified_since_enabled: true,
  highlights_tweets_tab_ui_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  subscriptions_feature_can_gift_premium: false,
};

function normalizeHandle(handle) {
  return String(handle || "")
    .trim()
    .replace(/^@/, "");
}

function parseArgs(argv) {
  const envPages = Number(process.env.USER_PAGES || process.env.PAGES || 10);
  const args = {
    user: normalizeHandle(
      process.env.TWITTER_USER ||
        process.env.HANDLE ||
        process.env.USERNAME ||
        ""
    ),
    userId: process.env.USER_ID || null,
    count: Number(process.env.COUNT || 20),
    delayMs: Number(process.env.DELAY_MS || process.env.DELAY || 1500),
    maxPages: Number.isFinite(envPages) && envPages > 0 ? envPages : 10,
    out: (() => {
      const out = process.env.USER_OUT || null;
      if (out) return path.resolve(__dirname, out);
      return path.join(__dirname, "user-tweets.json");
    })(),
    rawDir: process.env.RAW_DIR
      ? path.resolve(__dirname, process.env.RAW_DIR)
      : null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if ((a === "--user" || a === "--handle" || a === "--username") && next) {
      args.user = normalizeHandle(next);
      i++;
    } else if (a === "--user-id" && next) {
      args.userId = next;
      i++;
    } else if (a === "--count" && next) {
      args.count = Number(next);
      i++;
    } else if (a === "--delay" && next) {
      args.delayMs = Number(next);
      i++;
    } else if ((a === "--pages" || a === "--max-pages") && next) {
      args.maxPages = Number(next);
      i++;
    } else if (a === "--out" && next) {
      args.out = path.resolve(next);
      i++;
    } else if (a === "--raw-dir" && next) {
      args.rawDir = path.resolve(next);
      i++;
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    }
  }

  return args;
}

async function resolveUserId({ handle, auth, tx }) {
  const variables = {
    screen_name: handle,
    withSafetyModeUserFields: true,
  };

  let lastErr = null;
  for (const id of USER_BY_SCREEN_IDS) {
    const graphqlPath = `/i/api/graphql/${id}/UserByScreenName`;
    try {
      const json = await graphqlGetWithRetry({
        graphqlPath,
        variables,
        features: USER_FEATURES,
        auth,
        tx,
        referer: `https://x.com/${handle}`,
      });
      const user = json?.data?.user?.result;
      const userId = user?.rest_id;
      if (userId) {
        return {
          userId,
          name: user?.core?.name || user?.legacy?.name,
          username: user?.core?.screen_name || user?.legacy?.screen_name || handle,
        };
      }
      lastErr = new Error(`No rest_id in response for query ${id}`);
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    `Could not resolve @${handle} to userId. ${lastErr?.message || ""}`.trim()
  );
}

async function fetchUserTweetsPage({
  userId,
  handle,
  count,
  cursor,
  auth,
  tx,
}) {
  const variables = {
    userId,
    count,
    includePromotedContent: true,
    withQuickPromoteEligibilityTweetFields: true,
    withVoice: true,
  };
  if (cursor) variables.cursor = cursor;

  return graphqlGetWithRetry({
    graphqlPath: USER_TWEETS_PATH,
    variables,
    features: TIMELINE_FEATURES,
    fieldToggles: { withArticlePlainText: false },
    auth,
    tx,
    referer: `https://x.com/${handle}`,
  });
}

async function fetchUserTimeline(opts) {
  const auth = loadAuth();
  const handle = normalizeHandle(opts.user);

  console.log("Warming session...");
  await warmSession(auth);
  const tx = await createTxGenerator();

  let userId = opts.userId;
  let profile = { userId, username: handle, name: null };

  if (!userId) {
    if (!handle) throw new Error("Provide --user handle or --user-id");
    console.log(`Resolving @${handle}...`);
    profile = await resolveUserId({ handle, auth, tx });
    userId = profile.userId;
  }

  console.log(
    `User: @${profile.username || handle} (${userId}) | pages<=${opts.maxPages}`
  );

  if (opts.rawDir) fs.mkdirSync(opts.rawDir, { recursive: true });

  const seenIds = new Set();
  const allTweets = [];
  let cursor = null;
  let page = 0;

  while (page < opts.maxPages) {
    page++;
    console.log(`\n--- page ${page}${cursor ? " (cursor)" : " (first)"} ---`);

    const json = await fetchUserTweetsPage({
      userId,
      handle: profile.username || handle || "i",
      count: opts.count,
      cursor,
      auth,
      tx,
    });

    if (opts.rawDir) {
      const rawPath = path.join(
        opts.rawDir,
        `user-page-${String(page).padStart(3, "0")}.json`
      );
      fs.writeFileSync(rawPath, JSON.stringify(json, null, 2));
    }

    if (json.errors?.length) {
      console.error("API errors:", JSON.stringify(json.errors, null, 2));
      break;
    }

    const tweets = parseTimeline(json);
    let newCount = 0;
    for (const t of tweets) {
      if (!t?.id || seenIds.has(t.id)) continue;
      seenIds.add(t.id);
      allTweets.push(t);
      newCount++;
    }

    const { bottom } = extractCursors(json);
    console.log(
      `tweets this page: ${tweets.length} | new: ${newCount} | total: ${allTweets.length}`
    );

    if (!bottom) {
      console.log("No bottom cursor — last page reached.");
      break;
    }
    if (bottom === cursor) {
      console.log("Bottom cursor unchanged — last page reached.");
      break;
    }
    if (tweets.length === 0) {
      console.log("Empty page — last page reached.");
      break;
    }

    cursor = bottom;
    await sleep(opts.delayMs);
  }

  if (page >= opts.maxPages) {
    console.log(`Stopped at max pages (${opts.maxPages}).`);
  }

  return { profile, tweets: allTweets };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || (!args.user && !args.userId)) {
    console.log(`Usage:
  node twitter-user.js --user narendramodi
  node twitter-user.js --user narendramodi --pages 5 --out modi-tweets.json

Options (CLI overrides .env):
  --user / --handle   Twitter username (without @)
  --user-id           Skip resolve; use numeric user id directly
  --pages             Stop after this page number
  --count             Tweets per page (default 20)
  --delay             Ms between pages
  --out               Output JSON path (default user-tweets.json)
  --raw-dir           Save raw API pages

.env keys: TWITTER_USER / HANDLE, USER_ID, USER_PAGES / PAGES, USER_OUT, COUNT, DELAY_MS
Auth: twitter-auth.json`);
    process.exit(args.help ? 0 : 1);
  }

  const { profile, tweets } = await fetchUserTimeline(args);
  const payload = {
    user: {
      id: profile.userId,
      username: profile.username,
      name: profile.name,
    },
    fetchedAt: new Date().toISOString(),
    count: tweets.length,
    tweets,
  };
  fs.writeFileSync(args.out, JSON.stringify(payload, null, 2));
  console.log(`\nDone. ${tweets.length} tweets -> ${args.out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
