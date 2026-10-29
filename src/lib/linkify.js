// Pure URL tokenizer used by <LinkifiedText>. Splits a string into plain-text
// and link parts WITHOUT altering any character: joining every part's `text`
// always gives back the exact input (so whitespace / newlines survive and the
// `white-space: pre-wrap` styling keeps working).
//
// Deliberately conservative to avoid false positives and unsafe hrefs:
//  - only `http://`, `https://` and `www.` prefixes are recognised (no bare
//    "example.com", so "e.g." / "v2.0" / file names never turn into links);
//  - the href is always rebuilt through `new URL()` and must be http(s);
//    `javascript:`, `data:` etc. can never be produced;
//  - no regex lookbehind (unsupported on Safari < 16.4).

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>]+/gi;

// Characters that are almost always sentence punctuation, not part of the URL.
const TRAILING_PUNCT =
  ".,!?;:'\"*_~\u2019\u201D\u00BB" +
  "\u0964\u0965" + // Hindi/Bengali danda (। ॥)
  "\u3002\u3001\uFF0C\uFF01\uFF1F\uFF1B\uFF1A\uFF09\u3011\u300D"; // 。、，！？；：）】」
const PAIRS = { ")": "(", "]": "[", "}": "{" };

function count(str, ch) {
  let n = 0;
  for (let i = 0; i < str.length; i += 1) if (str[i] === ch) n += 1;
  return n;
}

// A URL never legitimately contains emoji or zero-width characters; if one is
// glued to the end ("https://a.com😀", pasted zero-width space) stop before it.
const JUNK_RE = /[\u200B-\u200D\u2060\uFEFF\uFE0F\u2600-\u27BF\u{1F000}-\u{1FFFF}]/u;
function cutAtJunk(raw) {
  const m = JUNK_RE.exec(raw);
  return m ? raw.slice(0, m.index) : raw;
}

// Strip trailing punctuation / unbalanced closing brackets from a raw match.
function trimTrailing(raw) {
  let url = raw;
  for (;;) {
    const last = url[url.length - 1];
    if (!last) break;
    if (TRAILING_PUNCT.includes(last)) {
      url = url.slice(0, -1);
    } else if (PAIRS[last] && count(url, last) > count(url, PAIRS[last])) {
      url = url.slice(0, -1);
    } else {
      break;
    }
  }
  return url;
}

// Returns a safe absolute http(s) href for the candidate, or null.
export function toSafeHref(candidate) {
  const withScheme = /^www\./i.test(candidate) ? `https://${candidate}` : candidate;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // "https://google.com@evil.com" displays like google.com but goes to
    // evil.com — never link URLs that carry credentials.
    if (u.username || u.password) return null;
    // Needs a real-looking host ("https://localhost" / "https://x" -> not a link).
    if (!u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {Array<{type: "text"|"link", text: string, href?: string}>}
 */
export function linkify(text) {
  if (typeof text !== "string" || text.length === 0) return [{ type: "text", text: text ?? "" }];

  const parts = [];
  let cursor = 0;
  URL_RE.lastIndex = 0;
  let match;
  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    // Don't start a link in the middle of a word ("foohttp://…", "a.www.b").
    const prev = start > 0 ? text[start - 1] : "";
    const isWww = /^www\./i.test(match[0]);
    if (prev && (isWww ? /[\w@./-]/ : /[\w@]/).test(prev)) continue;

    const url = trimTrailing(cutAtJunk(match[0]));
    const href = url ? toSafeHref(url) : null;
    if (!href) continue;

    if (start > cursor) parts.push({ type: "text", text: text.slice(cursor, start) });
    parts.push({ type: "link", text: url, href });
    cursor = start + url.length;
    // Any trimmed trailing punctuation stays in the following text part.
    URL_RE.lastIndex = cursor;
  }
  if (cursor < text.length) parts.push({ type: "text", text: text.slice(cursor) });
  return parts.length ? parts : [{ type: "text", text }];
}
