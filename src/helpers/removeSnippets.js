/*
 * Linear-time removal of the legacy ad and embed snippets that parseBody
 * strips from post bodies.
 *
 * These were regexes of the shape PREFIX.*PART.*PART… with greedy `.*`. A
 * backtracking regex engine retries every split point of every `.*` from
 * every PREFIX occurrence, so one long line full of partial matches took
 * seconds (13 s for 8 KB in the worst pattern) and blocked the event loop on
 * every publish. The functions below return exactly what
 * `text.replace(regex, '')` returned, in linear time, using three properties
 * of these regexes:
 *
 * - `.` never matches a line terminator, so everything after PREFIX sits on
 *   the line where PREFIX ends.
 * - If the parts cannot follow the first PREFIX on that line, they cannot
 *   follow a later one either (the first `.*` absorbs the gap), so the match
 *   starts at the first PREFIX that has the parts after it.
 * - Greedy `.*` makes the match end after the LAST occurrence of the final
 *   part on that line.
 *
 * test/removeSnippets.test.js checks both functions against the original
 * regexes on random input.
 */

// `.` in a regex without the `s` flag excludes exactly these.
const lineTerminator = /[\n\r\u2028\u2029]/g;

const lineEndFrom = (text, from) => {
  lineTerminator.lastIndex = from;
  const match = lineTerminator.exec(text);
  return match ? match.index : text.length;
};

// The `i` flag for an ASCII-only pattern: without the `u` flag, no
// non-ASCII character folds onto an ASCII letter. Keeps the length, so
// indexes stay valid in the original text.
const asciiLowerCase = text => text.replace(/[A-Z]+/g, s => s.toLowerCase());

/**
 * What `text.replace(/PREFIX.*PART.*PART…/, '')` returns, without
 * backtracking.
 *
 * @param {string} text
 * @param {string|RegExp} prefix a literal, or a RegExp with the `g` flag
 *   (and its own `i` flag) when the prefix is itself a pattern
 * @param {string[]} parts the literals after each `.*`, in order
 * @param {{ignoreCase?: boolean, global?: boolean}} [flags] the regex flags
 */
const removeChain = (
  text,
  prefix,
  parts,
  { ignoreCase = false, global = true } = {},
) => {
  const hay = ignoreCase ? asciiLowerCase(text) : text;
  const needles = ignoreCase ? parts.map(asciiLowerCase) : parts;
  const lastNeedle = needles[needles.length - 1];
  const prefixNeedle =
    typeof prefix === 'string' && ignoreCase ? asciiLowerCase(prefix) : prefix;
  const findPrefix = from => {
    if (typeof prefixNeedle === 'string') {
      const start = hay.indexOf(prefixNeedle, from);
      return start === -1 ? null : { start, end: start + prefixNeedle.length };
    }
    prefixNeedle.lastIndex = from;
    const match = prefixNeedle.exec(text);
    return match
      ? { start: match.index, end: match.index + match[0].length }
      : null;
  };

  let result = '';
  let copied = 0;
  let from = 0;
  // End of the line examined last. A later prefix that ends on the same line
  // has a subset of the options of the one examined, so it is skipped.
  let examinedLineEnd = -1;
  for (;;) {
    const found = findPrefix(from);
    if (!found) break;
    if (found.end <= examinedLineEnd) {
      from = found.start + 1;
      continue;
    }
    const lineEnd = lineEndFrom(hay, found.end);
    examinedLineEnd = lineEnd;
    const rest = hay.slice(found.end, lineEnd);
    let position = 0;
    const complete = needles.every(needle => {
      const index = rest.indexOf(needle, position);
      position = index + needle.length;
      return index !== -1;
    });
    if (!complete) {
      from = found.start + 1;
      continue;
    }
    const end = found.end + rest.lastIndexOf(lastNeedle) + lastNeedle.length;
    result += text.slice(copied, found.start);
    copied = end;
    if (!global) break;
    from = end;
  }
  return result + text.slice(copied);
};

const bannerPrefix = '<a href="https://travelfeed.io/@';
const bannerEnd =
  ' on travelfeed.io for the best experience</h3></center></a><hr />';

// Whether the whole of `middle` (lower-cased) matches
//   .*/.*"><center>(?:|<img src=".*" alt=".*"\/>)<h3>read (?:this post|".*")
const bannerMiddleMatches = middle => {
  const slash = middle.indexOf('/');
  if (slash === -1) return false;
  // The earliest image block after the slash: later elements only need to
  // come before the heading, so the first fit is the best fit.
  const image = middle.indexOf('"><center><img src="', slash + 1);
  const alt = image === -1 ? -1 : middle.indexOf('" alt="', image + 20);
  // `heading` is where `<h3>read ` starts. Before it comes either
  // `"><center>` or the image block, which ends with `"/>`.
  const headingFits = heading =>
    (slash + 1 <= heading - 10 &&
      middle.startsWith('"><center>', heading - 10)) ||
    (alt !== -1 &&
      alt + 7 <= heading - 3 &&
      middle.startsWith('"/>', heading - 3));
  if (middle.endsWith('<h3>read this post') && headingFits(middle.length - 18))
    return true;
  if (!middle.endsWith('"')) return false;
  for (
    let heading = middle.indexOf('<h3>read "');
    heading !== -1 && heading + 10 <= middle.length - 1;
    heading = middle.indexOf('<h3>read "', heading + 1)
  ) {
    if (headingFits(heading)) return true;
  }
  return false;
};

/**
 * What `text.replace(tfAdTop, '')` returns for the TravelFeed.io banner:
 * /<a href="https:\/\/travelfeed\.io\/@.*\/.*"><center>(?:|<img src=".*" alt=".*"\/>)<h3>Read (?:this post|".*") on TravelFeed\.io for the best experience<\/h3><\/center><\/a><hr \/>\n\n/i
 * Its alternations do not fit removeChain. But the match must end its line
 * with the closing tags followed by an empty line, which fixes the end.
 */
const removeTfAdTop = text => {
  const hay = asciiLowerCase(text);
  let from = 0;
  for (;;) {
    const start = hay.indexOf(bannerPrefix, from);
    if (start === -1) return text;
    const lineEnd = lineEndFrom(hay, start);
    const middleStart = start + bannerPrefix.length;
    const middleEnd = lineEnd - bannerEnd.length;
    if (
      hay[lineEnd] === '\n' &&
      hay[lineEnd + 1] === '\n' &&
      middleStart <= middleEnd &&
      hay.startsWith(bannerEnd, middleEnd) &&
      bannerMiddleMatches(hay.slice(middleStart, middleEnd))
    )
      return text.slice(0, start) + text.slice(lineEnd + 2);
    from = lineEnd + 1;
  }
};

// The snippets parseBody strips, each above the regex it replaces.
const removeSnippet = {
  // /\[\/\/\]:\S?\s\(.*\)/g
  markdownComment: text => removeChain(text, /\[\/\/\]:\S?\s\(/g, [')']),
  // /Posted using \[Partiko .*]\(.*\)/g
  partikoAd: text => removeChain(text, 'Posted using [Partiko ', ['](', ')']),
  // /<hr \/><center>View this post <a href="https:\/\/travelfeed\.io\/@.*">on the TravelFeed dApp<\/a> for the best experience\.<\/center>/g
  travelfeedDappAd: text =>
    removeChain(
      text,
      '<hr /><center>View this post <a href="https://travelfeed.io/@',
      ['">on the TravelFeed dApp</a> for the best experience.</center>'],
    ),
  // /\n\n---\n\nView this post \[on TravelFeed]\(https:\/\/travelfeed\.io\/@.*\/.*\) for the best experience\./i
  travelfeedBottomAd: text =>
    removeChain(
      text,
      '\n\n---\n\nView this post [on TravelFeed](https://travelfeed.io/@',
      ['/', ') for the best experience.'],
      { ignoreCase: true, global: false },
    ),
  travelfeedTopAd: removeTfAdTop,
  // /\[!\[dclick-imagead]\(h.*\)]\(.*\)/g
  dclickImageAd: text =>
    removeChain(text, '[![dclick-imagead](h', [')](', ')']),
  // /#####.*<sub>.*\*\*Sponsored \( Powered by \[dclick]\(https:\/\/www\.dclick\.io\) \)\*\* <\/sub>/g
  dclickSponsoredAd: text =>
    removeChain(text, '#####', [
      '<sub>',
      '**Sponsored ( Powered by [dclick](https://www.dclick.io) )** </sub>',
    ]),
  // /<a href='https:\/\/.*tripsteem\.com\/post\/.*'>.*<\/a>/g
  tripsteemAd: text =>
    removeChain(text, "<a href='https://", [
      'tripsteem.com/post/',
      "'>",
      '</a>',
    ]),
  // /!\b(?:steemitworldmap|pinmapple)\b\s(…lat…)\s\blat\b\s(…long…)\s\blong.*d3scr/gi
  swmWithDescription: text =>
    removeChain(
      text,
      /!\b(?:steemitworldmap|pinmapple)\b\s((?:[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)))\s\blat\b\s((?:[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)))\s\blong/gi,
      ['d3scr'],
      { ignoreCase: true },
    ),
  // /<div json='.*'>.*<\/div>/gi
  json: text =>
    removeChain(text, "<div json='", ["'>", '</div>'], { ignoreCase: true }),
  // /<center><a href='https:\/\/d\.tube\/#!\/v\/(.*)\/(.*)'><img src='https:\/\/ipfs\.io\/ipfs\/.*'><\/a><\/center><hr>/i
  dtubePreviewImage: text =>
    removeChain(
      text,
      "<center><a href='https://d.tube/#!/v/",
      ['/', "'><img src='https://ipfs.io/ipfs/", "'></a></center><hr>"],
      { ignoreCase: true, global: false },
    ),
};

module.exports = { removeChain, removeTfAdTop, removeSnippet };
