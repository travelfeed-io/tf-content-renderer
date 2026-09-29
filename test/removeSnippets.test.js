const assert = require('node:assert/strict');
const test = require('node:test');
const { removeSnippet } = require('../src/helpers/removeSnippets');

// Each case pairs a regex parseBody used to run with the remover that
// replaced it.
// The regexes are the reference: on random input, both must return the
// same string. FUZZ_ITERATIONS raises the per-case count for a deeper run.
const iterations = Number(process.env.FUZZ_ITERATIONS) || 20000;

// Marks a `.*` position in a case's shape.
const GAP = Symbol('gap');

const cases = [
  {
    name: 'partikoAd',
    shape: pick => [
      pick(['Posted using [Partiko ', 'posted using [partiko ']),
      GAP,
      '](',
      GAP,
      ')',
    ],
    regex: /Posted using \[Partiko .*]\(.*\)/g,
    remove: removeSnippet.partikoAd,
    tokens: ['Posted using [Partiko ', '](', ')', ']', '(', 'Android'],
  },
  {
    name: 'travelfeedDappAd',
    shape: () => [
      '<hr /><center>View this post <a href="https://travelfeed.io/@',
      GAP,
      '">on the TravelFeed dApp</a> for the best experience.</center>',
    ],
    regex: /<hr \/><center>View this post <a href="https:\/\/travelfeed\.io\/@.*">on the TravelFeed dApp<\/a> for the best experience\.<\/center>/g,
    remove: removeSnippet.travelfeedDappAd,
    tokens: [
      '<hr /><center>View this post <a href="https://travelfeed.io/@',
      '">on the TravelFeed dApp</a> for the best experience.</center>',
      '">on the TravelFeed dApp</a>',
      'user/perm',
    ],
  },
  {
    name: 'travelfeedBottomAd',
    shape: pick => [
      pick([
        '\n\n---\n\nView this post [on TravelFeed](https://travelfeed.io/@',
        '\n\n---\n\nVIEW THIS POST [ON TRAVELFEED](HTTPS://TRAVELFEED.IO/@',
        '\n---\n\nView this post [on TravelFeed](https://travelfeed.io/@',
      ]),
      GAP,
      '/',
      GAP,
      pick([') for the best experience.', ') FOR THE BEST EXPERIENCE.']),
    ],
    regex: /\n\n---\n\nView this post \[on TravelFeed]\(https:\/\/travelfeed\.io\/@.*\/.*\) for the best experience\./i,
    remove: removeSnippet.travelfeedBottomAd,
    tokens: [
      '\n\n---\n\nView this post [on TravelFeed](https://travelfeed.io/@',
      '\n\n---\n\nVIEW THIS POST [ON TRAVELFEED](HTTPS://TRAVELFEED.IO/@',
      '---',
      '/',
      ') for the best experience.',
      ') FOR THE BEST EXPERIENCE.',
      ')',
    ],
  },
  {
    name: 'dclickImageAd',
    shape: () => ['[![dclick-imagead](h', GAP, ')](', GAP, ')'],
    regex: /\[!\[dclick-imagead]\(h.*\)]\(.*\)/g,
    remove: removeSnippet.dclickImageAd,
    tokens: ['[![dclick-imagead](h', ')](', ')', ']', '(', 'ttps://x'],
  },
  {
    name: 'dclickSponsoredAd',
    shape: pick => [
      pick(['#####', '######', '####']),
      GAP,
      '<sub>',
      GAP,
      '**Sponsored ( Powered by [dclick](https://www.dclick.io) )** </sub>',
    ],
    regex: /#####.*<sub>.*\*\*Sponsored \( Powered by \[dclick]\(https:\/\/www\.dclick\.io\) \)\*\* <\/sub>/g,
    remove: removeSnippet.dclickSponsoredAd,
    tokens: [
      '#####',
      '#',
      '<sub>',
      '**Sponsored ( Powered by [dclick](https://www.dclick.io) )** </sub>',
      '</sub>',
    ],
  },
  {
    name: 'tripsteemAd',
    shape: () => [
      "<a href='https://",
      GAP,
      'tripsteem.com/post/',
      GAP,
      "'>",
      GAP,
      '</a>',
    ],
    regex: /<a href='https:\/\/.*tripsteem\.com\/post\/.*'>.*<\/a>/g,
    remove: removeSnippet.tripsteemAd,
    tokens: ["<a href='https://", 'tripsteem.com/post/', "'>", '</a>', "'"],
  },
  {
    name: 'swmWithDescription',
    shape: pick => [
      pick([
        '!steemitworldmap 12.5 lat -45.25 long',
        '!pinmapple 90 lat 180 long',
        '!SteemitWorldMap 1 lat 1 LONG',
        '!steemitworldmap\n1 lat\n1 long',
        '!steemitworldmap 95 lat 1 long',
        '!pinmapple 90.0 lat 181 long',
        '!steemitworldmap 1 lat 1 longer',
      ]),
      GAP,
      pick(['d3scr', 'D3SCR']),
    ],
    regex: /!\b(?:steemitworldmap|pinmapple)\b\s((?:[-+]?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)))\s\blat\b\s((?:[-+]?(?:180(?:\.0+)?|(?:(?:1[0-7]\d)|(?:[1-9]?\d))(?:\.\d+)?)))\s\blong.*d3scr/gi,
    remove: removeSnippet.swmWithDescription,
    tokens: [
      '!steemitworldmap 12.5 lat -45.25 long',
      '!pinmapple 90 lat 180 long',
      '!SteemitWorldMap 1 lat 1 LONG',
      '!steemitworldmap\n1 lat\n1 long',
      '!steemitworldmap 95 lat 1 long',
      '!pinmapple 9',
      ' lat 1 long',
      'd3scr',
      'D3SCR',
      'long',
      'x',
    ],
  },
  {
    name: 'json',
    shape: pick => [
      pick(["<div json='", "<DIV JSON='", "<Div Json='"]),
      GAP,
      "'>",
      GAP,
      pick(['</div>', '</DIV>']),
    ],
    regex: /<div json='.*'>.*<\/div>/gi,
    remove: removeSnippet.json,
    tokens: [
      "<div json='",
      "<DIV JSON='",
      "'>",
      '</div>',
      '</DIV>',
      '{"a":1}',
      "'",
    ],
  },
  {
    name: 'dtubePreviewImage',
    shape: pick => [
      pick([
        "<center><a href='https://d.tube/#!/v/",
        "<CENTER><A HREF='HTTPS://D.TUBE/#!/V/",
      ]),
      GAP,
      '/',
      GAP,
      "'><img src='https://ipfs.io/ipfs/",
      GAP,
      pick(["'></a></center><hr>", "'></A></CENTER><HR>"]),
    ],
    regex: /<center><a href='https:\/\/d\.tube\/#!\/v\/(.*)\/(.*)'><img src='https:\/\/ipfs\.io\/ipfs\/.*'><\/a><\/center><hr>/i,
    remove: removeSnippet.dtubePreviewImage,
    tokens: [
      "<center><a href='https://d.tube/#!/v/",
      "<CENTER><A HREF='HTTPS://D.TUBE/#!/V/",
      '/',
      "'><img src='https://ipfs.io/ipfs/",
      "'></a></center><hr>",
      "'></A></CENTER><HR>",
      'Qm',
    ],
  },
  {
    name: 'markdownComment',
    shape: pick => [
      pick([
        '[//]: (',
        '[//]:# (',
        '[//]:\n(',
        '[//]:\u2028(',
        '[//]:# \n(',
        '[//]:  (',
        '[//]:\t(',
      ]),
      GAP,
      ')',
    ],
    regex: /\[\/\/\]:\S?\s\(.*\)/g,
    remove: removeSnippet.markdownComment,
    tokens: [
      '[//]: (',
      '[//]:# (',
      '[//]:\n(',
      '[//]:',
      ' (',
      '(',
      ')',
      '\u00a0',
    ],
  },
  {
    name: 'travelfeedTopAd',
    shape: (pick, coin) => [
      pick([
        '<a href="https://travelfeed.io/@',
        '<A HREF="HTTPS://TRAVELFEED.IO/@',
      ]),
      GAP,
      '/',
      GAP,
      '"><center>',
      ...(coin() ? [] : ['<img src="', GAP, '" alt="', GAP, '"/>']),
      pick(['<h3>Read ', '<H3>READ ']),
      ...(coin() ? ['this post'] : ['"', GAP, '"']),
      pick([
        ' on TravelFeed.io for the best experience</h3></center></a><hr />',
        ' ON TRAVELFEED.IO FOR THE BEST EXPERIENCE</H3></CENTER></A><HR />',
      ]),
      pick(['\n\n', '\n\n', '\n', '\r\n\r\n', '\n\nx']),
    ],
    regex: /<a href="https:\/\/travelfeed\.io\/@.*\/.*"><center>(?:|<img src=".*" alt=".*"\/>)<h3>Read (?:this post|".*") on TravelFeed\.io for the best experience<\/h3><\/center><\/a><hr \/>\n\n/i,
    remove: removeSnippet.travelfeedTopAd,
    tokens: [
      '<a href="https://travelfeed.io/@',
      '<A HREF="HTTPS://TRAVELFEED.IO/@',
      '/',
      '"><center>',
      '<img src="',
      '" alt="',
      '"/>',
      '<h3>Read ',
      '<H3>READ ',
      'this post',
      '"',
      ' on TravelFeed.io for the best experience</h3></center></a><hr />',
      ' ON TRAVELFEED.IO FOR THE BEST EXPERIENCE</H3></CENTER></A><HR />',
    ],
  },
];

// Filler shared by every case: line terminators, case variants and
// characters the patterns treat specially.
const filler = [
  '\n',
  '\n\n',
  '\r\n',
  '\r',
  '\u2028',
  '\u2029',
  ' ',
  'a',
  'Z',
  '.',
  '"',
  "'",
];

// mulberry32: deterministic, so a failure reproduces with the same seed.
const random = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// A near-complete match: the case's shape with each GAP filled from the
// pool, then up to two random edits (drop, repeat, insert, change case or
// cut a piece), so inputs land on both sides of the match boundary.
const nearMatch = (c, next, pool) => {
  const pick = list => list[Math.floor(next() * list.length)];
  const coin = () => next() < 0.5;
  const gap = () => {
    let text = '';
    for (let n = Math.floor(next() * 3); n > 0; n -= 1) text += pick(pool);
    return text;
  };
  const pieces = c
    .shape(pick, coin)
    .map(piece => (piece === GAP ? gap() : piece));
  for (
    let edits = Math.floor(next() * 3);
    edits > 0 && pieces.length;
    edits -= 1
  ) {
    const i = Math.floor(next() * pieces.length);
    const kind = next();
    if (kind < 0.2) pieces.splice(i, 1);
    else if (kind < 0.4) pieces.splice(i, 0, pieces[i]);
    else if (kind < 0.6) pieces.splice(i, 0, pick(pool));
    else if (kind < 0.8)
      pieces[i] = coin() ? pieces[i].toUpperCase() : pieces[i].toLowerCase();
    else pieces[i] = pieces[i].slice(0, Math.floor(next() * pieces[i].length));
  }
  return pieces.join('');
};

for (const c of cases) {
  test(`${c.name}: same result as the regex on random input`, () => {
    const next = random(0x5eed + c.name.length);
    const pick = list => list[Math.floor(next() * list.length)];
    const pool = c.tokens.concat(filler);
    // Fragments of the tokens make near-misses more likely.
    c.tokens.forEach(token => {
      if (token.length > 2) {
        const cut = 1 + Math.floor(next() * (token.length - 1));
        pool.push(token.slice(0, cut), token.slice(cut));
      }
    });
    for (let i = 0; i < iterations; i += 1) {
      let input = '';
      if (next() < 0.3) {
        // Plain token soup.
        for (let n = Math.floor(next() * 14); n > 0; n -= 1)
          input += pick(pool);
      } else {
        // One to three near-matches, with filler around them.
        input += pick(pool);
        for (let n = 1 + Math.floor(next() * 3); n > 0; n -= 1)
          input += nearMatch(c, next, pool) + pick(pool);
      }
      const expected = input.replace(c.regex, '');
      const actual = c.remove(input);
      if (actual !== expected)
        assert.fail(
          `mismatch for ${JSON.stringify(input)}\n` +
            `regex:  ${JSON.stringify(expected)}\n` +
            `linear: ${JSON.stringify(actual)}`,
        );
    }
  });
}

test('the snippets these patterns target are still removed', () => {
  const partiko =
    'Great trip!\n\nPosted using [Partiko Android](https://partiko.app/referral/jane)';
  assert.equal(cases[0].remove(partiko), 'Great trip!\n\n');
  const json = `Intro<div json='{"type":"map"}'>Map</div>\nNext line`;
  assert.equal(cases[7].remove(json), 'Intro\nNext line');
  const banner =
    '<a href="https://travelfeed.io/@jane/lisbon"><center><img src="https://x/y.jpg" alt="Lisbon"/><h3>Read "Lisbon" on TravelFeed.io for the best experience</h3></center></a><hr />\n\nBody';
  assert.equal(removeSnippet.travelfeedTopAd(banner), 'Body');
  // The pattern needs the `(` right after one whitespace, so it matches
  // `[//]:# (…)` but not the `[//]: # (…)` spelling. Kept as it was.
  const comment = 'Text\n[//]:# (hidden note)\nMore';
  assert.equal(cases[9].remove(comment), 'Text\n\nMore');
});

// Worst-case shapes: one long line of partial matches that never complete.
// The regexes took seconds at 8 KB; the linear versions handle 1 MB.
test('1 MB of partial matches finishes quickly', () => {
  const size = 1024 * 1024;
  const fill = unit =>
    unit.repeat(Math.ceil(size / unit.length)).slice(0, size);
  const inputs = [
    [cases[0], fill('Posted using [Partiko ](')],
    [
      cases[1],
      fill('<hr /><center>View this post <a href="https://travelfeed.io/@'),
    ],
    [
      cases[2],
      `\n\n---\n\nView this post [on TravelFeed](https://travelfeed.io/@${fill(
        '/)',
      )}`,
    ],
    [cases[3], fill('[![dclick-imagead](h)](')],
    [cases[4], fill('#####<sub>')],
    [cases[5], fill("<a href='https://tripsteem.com/post/'>")],
    [cases[6], fill('!steemitworldmap 1 lat 1 long ')],
    [cases[7], fill("<div json=''>")],
    [
      cases[8],
      fill(
        "<center><a href='https://d.tube/#!/v/'><img src='https://ipfs.io/ipfs/'>",
      ),
    ],
    [cases[9], fill('[//]: (')],
    [cases[10], fill('<a href="https://travelfeed.io/@/"><center><h3>Read ""')],
    [
      cases[10],
      `${fill(
        '<a href="https://travelfeed.io/@/"><center><h3>Read ""',
      )} on TravelFeed.io for the best experience</h3></center></a><hr />\n\n`,
    ],
  ];
  for (const [c, input] of inputs) {
    const started = process.hrtime.bigint();
    c.remove(input);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 1000, `${c.name} took ${ms.toFixed(0)} ms on 1 MB`);
  }
});
