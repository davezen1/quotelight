import assert from 'node:assert';
import { test } from 'node:test';
import { PLATFORMS, buildShareText, truncateQuote } from '../platforms/platforms.js';

const sampleMeta = {
  title: 'Why Innovation Matters',
  author: 'Jane Smith',
  siteName: 'The Atlantic',
  url: 'https://theatlantic.com/article/example'
};
const quote = 'The best ideas arise from a passionate commitment to the problem';

test('buildShareText produces full format with all metadata', () => {
  const text = buildShareText(quote, sampleMeta);
  assert.ok(text.includes(`"${quote}"`));
  assert.ok(text.includes('From "Why Innovation Matters" by Jane Smith -- The Atlantic'));
  assert.ok(text.includes(sampleMeta.url));
});

test('buildShareText degrades without author', () => {
  const meta = { ...sampleMeta, author: null };
  const text = buildShareText(quote, meta);
  assert.ok(text.includes('From "Why Innovation Matters" -- The Atlantic'));
  assert.ok(!text.includes(' by '));
});

test('buildShareText degrades without author or siteName', () => {
  const meta = { ...sampleMeta, author: null, siteName: null };
  const text = buildShareText(quote, meta);
  assert.ok(text.includes('From "Why Innovation Matters"'));
});

test('buildShareText with no metadata shows quote + URL', () => {
  const meta = { url: 'https://example.com' };
  const text = buildShareText(quote, meta);
  assert.ok(text.includes(`"${quote}"`));
  assert.ok(text.includes('https://example.com'));
  assert.ok(!text.includes('From'));
});

test('truncateQuote truncates long text and preserves URL', () => {
  const longQuote = 'A'.repeat(300);
  const result = truncateQuote(longQuote, sampleMeta.url, 280);
  assert.ok(result.length <= 280);
  assert.ok(result.includes(sampleMeta.url));
  assert.ok(result.includes('...'));
});

test('truncateQuote leaves short text intact', () => {
  const result = truncateQuote('Short quote', sampleMeta.url, 280);
  assert.ok(result.includes('Short quote'));
  assert.ok(result.includes(sampleMeta.url));
});

test('each platform has required fields', () => {
  for (const [key, platform] of Object.entries(PLATFORMS)) {
    assert.ok(platform.name, `${key} missing name`);
    assert.ok(platform.color, `${key} missing color`);
    assert.ok(platform.icon, `${key} missing icon`);
    assert.ok(typeof platform.buildUrl === 'function', `${key} missing buildUrl`);
  }
});

test('X platform builds correct intent URL', () => {
  const url = PLATFORMS.x.buildUrl(quote, sampleMeta);
  assert.ok(url.startsWith('https://x.com/intent/post?text='));
  assert.ok(url.includes(encodeURIComponent(sampleMeta.url)));
});

test('email platform builds mailto URL with subject and body', () => {
  const url = PLATFORMS.email.buildUrl(quote, sampleMeta);
  assert.ok(url.startsWith('mailto:?'));
  assert.ok(url.includes('subject='));
  assert.ok(url.includes('body='));
});

test('reddit platform puts quote in title and article as url', () => {
  const url = PLATFORMS.reddit.buildUrl(quote, sampleMeta);
  assert.ok(url.startsWith('https://reddit.com/submit?'));
  assert.ok(url.includes('title='));
  assert.ok(url.includes(`url=${encodeURIComponent(sampleMeta.url)}`));
});

test('linkedin only includes article URL', () => {
  const url = PLATFORMS.linkedin.buildUrl(quote, sampleMeta);
  assert.ok(url.includes(encodeURIComponent(sampleMeta.url)));
  assert.ok(!url.includes(encodeURIComponent(quote)));
});
