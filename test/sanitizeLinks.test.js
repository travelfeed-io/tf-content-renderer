const assert = require('node:assert/strict');
const test = require('node:test');
const { processBody } = require('../src');

const render = body => processBody(body).body;

// The button JSON as the reader's browser receives it.
const buttonData = html => {
  const match = /json="([^"]*)"/.exec(html);
  assert.ok(match, `no json attribute in ${html}`);
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    .data;
};

const button = data =>
  `<div json='${JSON.stringify({ type: 'button', data })}'>b</div>`;

test('an authored /exit link keeps its text but not a script target', () => {
  for (const target of [
    'javascript%3Aalert(1)',
    'JaVaScRiPt%3Aalert(1)',
    'data%3Atext%2Fhtml%2Cx',
    '%E0%A4%A', // malformed: decodeURIComponent throws
  ]) {
    const html = render(`<a href="/exit?url=${target}">read more</a>`);
    assert.ok(!html.includes('href'), `${target}: ${html}`);
    assert.ok(html.includes('read more'), `${target}: ${html}`);
  }
});

test('an authored /exit link to a web page stays a link', () => {
  const html = render(
    '<a href="/exit?url=https%3A%2F%2Fexample.com%2Fa">x</a>',
  );
  assert.ok(html.includes('href="/exit?url=https%3A%2F%2Fexample.com%2Fa"'));
});

test('ordinary links still work as before', () => {
  assert.ok(
    render('<a href="https://example.com/a">x</a>').includes(
      'href="/exit?url=https%3A%2F%2Fexample.com%2Fa"',
    ),
  );
  assert.ok(render('<a href="/@anna">x</a>').includes('href="/@anna"'));
  assert.ok(render('<a href="#part-2">x</a>').includes('href="#part-2"'));
});

test('a button link that is not a web link is replaced', () => {
  for (const link of [
    'javascript:alert(1)',
    'javascript://travelfeed.com/%0aalert(1)',
    ' data:text/html,x',
  ]) {
    const data = buttonData(render(button({ text: 'Go', link })));
    assert.equal(data.link, '#', link);
    assert.equal(data.isWhitelist, false, link);
  }
});

test('button whitelist status is recomputed, never taken from the author', () => {
  const forged = buttonData(
    render(
      button({ text: 'Go', link: 'https://evil.example/x', isWhitelist: true }),
    ),
  );
  assert.equal(forged.link, 'https://evil.example/x');
  assert.equal(forged.isWhitelist, false);
  const own = buttonData(
    render(button({ text: 'Go', link: 'https://travelfeed.com/@anna' })),
  );
  assert.equal(own.isWhitelist, true);
  const relative = buttonData(render(button({ text: 'Go', link: '/@anna' })));
  assert.equal(relative.link, '/@anna');
  assert.equal(relative.isWhitelist, true);
});
