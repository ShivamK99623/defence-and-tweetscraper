#!/usr/bin/env node
/**
 * Paginated X/Twitter SearchTimeline fetcher.
 *
 * Usage:
 *   node twitter-search.js                          # uses .env defaults
 *   node twitter-search.js --pages 5                # stop after page 5
 *   node twitter-search.js --query "..." --since 2025-05-01 --until 2025-05-15
 *
 * Auth — twitter-auth.json:
 *   { "auth_token": "...", "ct0": "...", "kdt": "...", "twid": "..." }
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  ClientTransaction,
  fetchXDocument,
} = require("x-client-transaction-id");
const { parseTimeline, extractCursors } = require("./tweetparsor");

const execFileAsync = promisify(execFile);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const GRAPHQL_ID = "hz_94eVAtrtQo_vO3my7Rw";
const GRAPHQL_PATH = `/i/api/graphql/${GRAPHQL_ID}/SearchTimeline`;
const ENDPOINT = `https://x.com${GRAPHQL_PATH}`;
const COOKIE_JAR = path.join(__dirname, ".twitter-cookie-jar.txt");

// Minimal feature set that SearchTimeline accepts (full browser set can 404).
const FEATURES = {
  rweb_video_screen_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: false,
  responsive_web_enhance_cards_enabled: false,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_edit_tweet_api_enabled: true,
  // needed for otherLangTxt
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_annotations_enabled: true,
};

const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

function parseArgs(argv) {
  const envPages = Number(process.env.PAGES || process.env.MAX_PAGES || 200);
  const args = {
    query: process.env.QUERY || null,
    since: process.env.SINCE || null,
    until: process.env.UNTIL || null,
    product: process.env.PRODUCT || "Latest",
    count: Number(process.env.COUNT || 20),
    delayMs: Number(process.env.DELAY_MS || process.env.DELAY || 1500),
    maxPages: Number.isFinite(envPages) && envPages > 0 ? envPages : 200,
    out: process.env.OUT
      ? path.resolve(__dirname, process.env.OUT)
      : path.join(__dirname, "tweets-parsed.json"),
    rawDir: process.env.RAW_DIR
      ? path.resolve(__dirname, process.env.RAW_DIR)
      : null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--query" && next) {
      args.query = next;
      i++;
    } else if (a === "--since" && next) {
      args.since = next;
      i++;
    } else if (a === "--until" && next) {
      args.until = next;
      i++;
    } else if (a === "--product" && next) {
      args.product = next;
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

function loadAuth() {
  const authPath = path.join(__dirname, "twitter-auth.json");
  if (!fs.existsSync(authPath)) {
    throw new Error(
      "Missing twitter-auth.json with auth_token, ct0, kdt from browser cookies."
    );
  }
  const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
  if (!auth.ct0 || !auth.auth_token) {
    throw new Error("twitter-auth.json needs auth_token and ct0");
  }
  return auth;
}

function parseCookieHeader(cookieStr) {
  const map = {};
  if (!cookieStr) return map;
  for (const part of cookieStr.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) map[k] = v;
  }
  return map;
}

function writeCookieJar(auth) {
  const fromHeader = parseCookieHeader(auth.cookie || "");
  const cookies = { ...fromHeader };
  if (auth.auth_token) cookies.auth_token = auth.auth_token;
  if (auth.ct0) cookies.ct0 = auth.ct0;
  if (auth.kdt) cookies.kdt = auth.kdt;
  if (auth.twid) cookies.twid = auth.twid;
  if (!cookies.lang) cookies.lang = "en";

  const lines = ["# Netscape HTTP Cookie File"];
  for (const [name, value] of Object.entries(cookies)) {
    if (!value) continue;
    lines.push(`.x.com\tTRUE\t/\tTRUE\t0\t${name}\t${value}`);
  }
  fs.writeFileSync(COOKIE_JAR, lines.join("\n") + "\n");
}

async function curl(args) {
  const { stdout } = await execFileAsync("curl", args, {
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout;
}

async function warmSession(auth) {
  writeCookieJar(auth);
  await curl([
    "-sS",
    "-c",
    COOKIE_JAR,
    "-b",
    COOKIE_JAR,
    "-o",
    "/dev/null",
    "https://x.com/home",
    "-H",
    `user-agent: ${UA}`,
  ]);
}

async function createTxGenerator() {
  console.log("Initializing x-client-transaction-id...");
  const document = await fetchXDocument();
  return ClientTransaction.create(document);
}

function buildQuery(base, since, until) {
  let q = base.trim();
  if (since) q += ` since:${since}`;
  if (until) q += ` until:${until}`;
  return q;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageOnce({ query, count, cursor, product, auth, tx }) {
  const variables = {
    rawQuery: query,
    count,
    querySource: "typed_query",
    product,
    withGrokTranslatedBio: true,
    withQuickPromoteEligibilityTweetFields: false,
  };
  if (cursor) variables.cursor = cursor;

  const url =
    `${ENDPOINT}?variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&features=${encodeURIComponent(JSON.stringify(FEATURES))}`;

  const tmpOut = path.join(__dirname, `.twitter-page-${process.pid}.json`);
  const tmpHdr = path.join(__dirname, `.twitter-page-${process.pid}.hdr`);
  const tid = await tx.generateTransactionId("GET", GRAPHQL_PATH);

  try {
    const status = (
      await curl([
        "-sS",
        "-o",
        tmpOut,
        "-D",
        tmpHdr,
        "-w",
        "%{http_code}",
        "-c",
        COOKIE_JAR,
        "-b",
        COOKIE_JAR,
        url,
        "-H",
        "accept: */*",
        "-H",
        `authorization: Bearer ${BEARER}`,
        "-H",
        "content-type: application/json",
        "-H",
        `x-csrf-token: ${auth.ct0}`,
        "-H",
        "x-twitter-auth-type: OAuth2Session",
        "-H",
        "x-twitter-active-user: yes",
        "-H",
        "x-twitter-client-language: en",
        "-H",
        `x-client-transaction-id: ${tid}`,
        "-H",
        `referer: https://x.com/search?q=${encodeURIComponent(query)}&src=typed_query`,
        "-H",
        `user-agent: ${UA}`,
      ])
    ).trim();

    const body = fs.existsSync(tmpOut) ? fs.readFileSync(tmpOut, "utf8") : "";
    const hdr = fs.existsSync(tmpHdr) ? fs.readFileSync(tmpHdr, "utf8") : "";
    const remaining = Number(
      (hdr.match(/x-rate-limit-remaining:\s*(\d+)/i) || [])[1] ?? NaN
    );
    const resetAt = Number(
      (hdr.match(/x-rate-limit-reset:\s*(\d+)/i) || [])[1] ?? 0
    );

    return { status, body, remaining, resetAt };
  } finally {
    if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
    if (fs.existsSync(tmpHdr)) fs.unlinkSync(tmpHdr);
  }
}

async function fetchPage(opts) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { status, body, remaining, resetAt } = await fetchPageOnce(opts);

    if (!Number.isNaN(remaining)) {
      console.log(`rate-limit remaining: ${remaining}`);
    }

    if (status === "429" || ((status === "404" || status === "403") && remaining === 0)) {
      const waitMs = Math.max(5_000, resetAt * 1000 - Date.now() + 2000);
      console.log(`Rate limited (HTTP ${status}). Waiting ${Math.ceil(waitMs / 1000)}s...`);
      await sleep(waitMs);
      continue;
    }

    if (status === "404" || status === "403") {
      throw new Error(
        `HTTP ${status}. Refresh auth cookies in twitter-auth.json (auth_token, ct0, kdt). Body: ${body.slice(0, 200)}`
      );
    }
    if (Number(status) < 200 || Number(status) >= 300) {
      throw new Error(`HTTP ${status}: ${body.slice(0, 500)}`);
    }

    return JSON.parse(body);
  }

  throw new Error("Exceeded rate-limit retries");
}

async function searchAll(opts) {
  const auth = loadAuth();
  const query = buildQuery(opts.query, opts.since, opts.until);

  console.log(`Query: ${query}`);
  console.log(
    `Product: ${opts.product} | count=${opts.count} | pages<=${opts.maxPages}`
  );

  console.log("Warming session...");
  await warmSession(auth);
  const tx = await createTxGenerator();

  if (opts.rawDir) fs.mkdirSync(opts.rawDir, { recursive: true });

  const seenIds = new Set();
  const allTweets = [];
  let cursor = null;
  let page = 0;

  while (page < opts.maxPages) {
    page++;
    console.log(`\n--- page ${page}${cursor ? " (cursor)" : " (first)"} ---`);

    const json = await fetchPage({
      query,
      count: opts.count,
      cursor,
      product: opts.product,
      auth,
      tx,
    });

    if (opts.rawDir) {
      const rawPath = path.join(
        opts.rawDir,
        `page-${String(page).padStart(3, "0")}.json`
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

  return allTweets;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.query) {
    console.log(`Usage:
  node twitter-search.js                         # uses .env
  node twitter-search.js --pages 5               # stop after page 5
  node twitter-search.js --query "..." --since YYYY-MM-DD --until YYYY-MM-DD

Options (CLI overrides .env):
  --query       Search query
  --since       Start date (YYYY-MM-DD)
  --until       End date (YYYY-MM-DD)
  --product     Top | Latest
  --pages       Stop after this page number (alias: --max-pages)
  --count       Tweets per page
  --delay       Ms between pages
  --out         Output JSON path
  --raw-dir     Optional folder to save raw API pages

.env keys: QUERY, SINCE, UNTIL, PRODUCT, PAGES, OUT, COUNT, DELAY_MS, RAW_DIR
Auth: twitter-auth.json with auth_token, ct0, kdt, twid`);
    process.exit(args.help ? 0 : 1);
  }

  const tweets = await searchAll(args);
  fs.writeFileSync(args.out, JSON.stringify(tweets, null, 2));
  console.log(`\nDone. ${tweets.length} tweets -> ${args.out}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
