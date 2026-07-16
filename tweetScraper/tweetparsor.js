const fs = require("fs");
const path = require("path");

function unwrapTweet(result) {
  if (!result) return null;
  if (result.__typename === "TweetWithVisibilityResults") {
    return result.tweet || null;
  }
  if (result.__typename === "Tweet" || result.rest_id) {
    return result;
  }
  return null;
}

function extractTranslatedText(tweet) {
  const grok = tweet?.grok_translated_post_with_availability;
  if (!grok?.is_available || !grok?.data) return null;
  return grok.data.translation || grok.data.preview_translation || null;
}

/** Pull sentiment if X includes it (often absent on public timelines). */
function extractSentiment(tweet) {
  if (!tweet) return null;

  const candidates = [
    tweet.sentiment,
    tweet.legacy?.sentiment,
    tweet.ext?.sentiment,
    tweet.grok_annotations?.sentiment,
    tweet.grok_annotations?.emotion,
    tweet.card?.legacy?.binding_values?.sentiment?.string_value,
  ];

  for (const s of candidates) {
    if (s == null || s === "") continue;
    if (typeof s === "string" || typeof s === "number") return s;
    if (typeof s === "object") {
      return (
        s.label ||
        s.value ||
        s.sentiment ||
        s.type ||
        s.name ||
        (typeof s.score === "number" ? s : null) ||
        null
      );
    }
  }

  return null;
}

function mapMedia(legacy) {
  return (
    legacy?.extended_entities?.media?.map((m) => ({
      id: m.id_str,
      type: m.type,
      url: m.media_url_https,
      expandedUrl: m.expanded_url,
    })) || []
  );
}

function mapNestedTweet(tweet) {
  tweet = unwrapTweet(tweet);
  if (!tweet) return null;

  const legacy = tweet.legacy || {};
  const note = tweet.note_tweet?.note_tweet_results?.result;
  const user = tweet.core?.user_results?.result;
  const userCore = user?.core || {};
  const language = legacy.lang;
  const otherLangTxt =
    language && language !== "en" ? extractTranslatedText(tweet) : null;

  return {
    id: tweet.rest_id,
    conversationId: legacy.conversation_id_str,
    createdAt: legacy.created_at,
    text: note?.text || legacy.full_text,
    language,
    otherLangTxt,
    sentiment: extractSentiment(tweet),

    authorId: user?.rest_id,
    authorName: userCore.name,
    authorUsername: userCore.screen_name,

    likes: legacy.favorite_count,
    replies: legacy.reply_count,
    reposts: legacy.retweet_count,
    quotes: legacy.quote_count,
    bookmarks: legacy.bookmark_count,
    views: Number(tweet.views?.count || 0),

    media: mapMedia(legacy),
  };
}

function mapTweet(tweet, comments = []) {
  tweet = unwrapTweet(tweet);
  if (!tweet) return null;

  const legacy = tweet.legacy || {};
  const note = tweet.note_tweet?.note_tweet_results?.result;
  const user = tweet.core?.user_results?.result;
  const userLegacy = user?.legacy || {};
  const userCore = user?.core || {};

  const quoted = unwrapTweet(tweet.quoted_status_result?.result);
  const retweeted = unwrapTweet(tweet.retweeted_status_result?.result);
  const language = legacy.lang;
  const otherLangTxt =
    language && language !== "en" ? extractTranslatedText(tweet) : null;

  return {
    id: tweet.rest_id,
    conversationId: legacy.conversation_id_str,
    createdAt: legacy.created_at,
    text: note?.text || legacy.full_text,
    language,
    otherLangTxt,
    sentiment: extractSentiment(tweet),

    authorId: user?.rest_id,
    authorName: userCore.name,
    authorUsername: userCore.screen_name,
    authorVerified:
      user?.verification?.verified || user?.is_blue_verified || false,
    authorFollowers: userLegacy.followers_count,
    authorAvatar: user?.avatar?.image_url,
    authorLocation: user?.location?.location,

    likes: legacy.favorite_count,
    replies: legacy.reply_count,
    reposts: legacy.retweet_count,
    quotes: legacy.quote_count,
    bookmarks: legacy.bookmark_count,
    views: Number(tweet.views?.count || 0),

    hasMedia: !!legacy.extended_entities?.media?.length,
    isQuote: !!legacy.is_quote_status,
    isRetweet: !!retweeted || /^RT @/i.test(legacy.full_text || ""),
    isSensitive: !!legacy.possibly_sensitive,

    media: mapMedia(legacy),

    quotedTweets: quoted ? [mapNestedTweet(quoted)].filter(Boolean) : [],
    retweetedTweet: retweeted ? mapNestedTweet(retweeted) : null,

    comments: comments.map(mapNestedTweet).filter(Boolean),

    permalink: userCore.screen_name
      ? `https://x.com/${userCore.screen_name}/status/${tweet.rest_id}`
      : `https://x.com/i/status/${tweet.rest_id}`,
  };
}

function getTweetFromItemContent(itemContent) {
  return unwrapTweet(itemContent?.tweet_results?.result);
}

function getInstructions(json) {
  // SearchTimeline
  const search =
    json?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions;
  if (Array.isArray(search)) return search;

  // UserTweets (timeline / timeline_v2)
  const user =
    json?.data?.user?.result?.timeline_v2?.timeline?.instructions ||
    json?.data?.user?.result?.timeline?.timeline?.instructions;
  if (Array.isArray(user)) return user;

  return [];
}

function extractCursors(json) {
  const instructions = getInstructions(json);
  let top = null;
  let bottom = null;

  for (const instruction of instructions) {
    const entries = [];
    if (Array.isArray(instruction.entries)) entries.push(...instruction.entries);
    if (instruction.entry) entries.push(instruction.entry);

    for (const entry of entries) {
      const content = entry?.content;
      if (!content) continue;
      if (content.cursorType === "Top") top = content.value;
      if (content.cursorType === "Bottom") bottom = content.value;
    }
  }

  return { top, bottom };
}

function parseTimeline(json) {
  const instructions = getInstructions(json);
  const tweets = [];

  for (const instruction of instructions) {
    if (!Array.isArray(instruction.entries)) continue;

    for (const entry of instruction.entries) {
      const content = entry.content;
      if (!content) continue;

      // Skip cursors / prompts
      if (content.cursorType) continue;

      if (
        content.entryType === "TimelineTimelineItem" ||
        content.__typename === "TimelineTimelineItem"
      ) {
        const tweet = getTweetFromItemContent(content.itemContent);
        if (tweet) tweets.push(mapTweet(tweet, []));
        continue;
      }

      if (
        content.entryType === "TimelineTimelineModule" ||
        content.__typename === "TimelineTimelineModule"
      ) {
        const items = content.items || [];
        const tweetResults = items
          .map((item) => getTweetFromItemContent(item.item?.itemContent))
          .filter(Boolean);

        if (tweetResults.length === 0) continue;

        const [parent, ...replies] = tweetResults;
        tweets.push(mapTweet(parent, replies));
      }
    }
  }

  return tweets;
}

module.exports = {
  parseTimeline,
  extractCursors,
  mapTweet,
  unwrapTweet,
  getInstructions,
  extractSentiment,
  extractTranslatedText,
};

if (require.main === module) {
  const raw = fs.readFileSync(path.join(__dirname, "twiiter-curl.json"), "utf8");
  const data = JSON.parse(raw);
  const tweets = parseTimeline(data);
  const outPath = path.join(__dirname, "tweets-parsed.json");
  fs.writeFileSync(outPath, JSON.stringify(tweets, null, 2));
  console.log(`Parsed ${tweets.length} tweets -> ${outPath}`);
}
