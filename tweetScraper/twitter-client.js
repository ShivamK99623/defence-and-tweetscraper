const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const {
  ClientTransaction,
  fetchXDocument,
} = require("x-client-transaction-id");

const execFileAsync = promisify(execFile);

const COOKIE_JAR = path.join(__dirname, ".twitter-cookie-jar.txt");

const BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

const TIMELINE_FEATURES = {
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
  // needed for otherLangTxt (grok_translated_post_with_availability)
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_annotations_enabled: true,
};

function loadEnvFile(filePath = path.join(__dirname, ".env")) {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

async function graphqlGet({
  graphqlPath,
  variables,
  features = TIMELINE_FEATURES,
  fieldToggles = null,
  auth,
  tx,
  referer = "https://x.com/home",
}) {
  let url =
    `https://x.com${graphqlPath}?variables=${encodeURIComponent(JSON.stringify(variables))}` +
    `&features=${encodeURIComponent(JSON.stringify(features))}`;
  if (fieldToggles) {
    url += `&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;
  }

  const tmpOut = path.join(__dirname, `.twitter-page-${process.pid}.json`);
  const tmpHdr = path.join(__dirname, `.twitter-page-${process.pid}.hdr`);
  const tid = await tx.generateTransactionId("GET", graphqlPath);

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
        `referer: ${referer}`,
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

async function graphqlGetWithRetry(opts) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { status, body, remaining, resetAt } = await graphqlGet(opts);

    if (!Number.isNaN(remaining)) {
      console.log(`rate-limit remaining: ${remaining}`);
    }

    if (
      status === "429" ||
      ((status === "404" || status === "403") && remaining === 0)
    ) {
      const waitMs = Math.max(5_000, resetAt * 1000 - Date.now() + 2000);
      console.log(
        `Rate limited (HTTP ${status}). Waiting ${Math.ceil(waitMs / 1000)}s...`
      );
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

module.exports = {
  COOKIE_JAR,
  BEARER,
  UA,
  TIMELINE_FEATURES,
  loadEnvFile,
  loadAuth,
  warmSession,
  createTxGenerator,
  graphqlGet,
  graphqlGetWithRetry,
  sleep,
};
