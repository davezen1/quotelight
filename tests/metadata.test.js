import assert from 'node:assert';
import { test } from 'node:test';
import { extractFromOpenGraph, extractFromJsonLd, extractFromTwitterCards, extractFromHeuristics, mergeMetadata } from '../content/metadata.js';

test('extractFromOpenGraph gets og:title', () => {
  const meta = extractFromOpenGraph({
    querySelector: (sel) => {
      const map = {
        'meta[property="og:title"]': { content: 'OG Title' },
        'meta[property="og:url"]': { content: 'https://example.com/article' },
        'meta[property="og:site_name"]': { content: 'Example Site' },
        'meta[name="author"]': { content: 'John Doe' },
      };
      return map[sel] || null;
    }
  });
  assert.strictEqual(meta.title, 'OG Title');
  assert.strictEqual(meta.url, 'https://example.com/article');
  assert.strictEqual(meta.siteName, 'Example Site');
  assert.strictEqual(meta.author, 'John Doe');
});

test('extractFromJsonLd parses Article schema', () => {
  const scriptContent = JSON.stringify({
    '@type': 'Article',
    headline: 'JSON-LD Title',
    author: { name: 'Jane Author' },
    publisher: { name: 'Publisher Co' }
  });
  const meta = extractFromJsonLd({
    querySelectorAll: () => [{ textContent: scriptContent }]
  });
  assert.strictEqual(meta.title, 'JSON-LD Title');
  assert.strictEqual(meta.author, 'Jane Author');
  assert.strictEqual(meta.siteName, 'Publisher Co');
});

test('extractFromJsonLd handles array of schemas', () => {
  const scriptContent = JSON.stringify([
    { '@type': 'WebPage', name: 'Not this' },
    { '@type': 'NewsArticle', headline: 'News Title', author: { name: 'Reporter' } }
  ]);
  const meta = extractFromJsonLd({
    querySelectorAll: () => [{ textContent: scriptContent }]
  });
  assert.strictEqual(meta.title, 'News Title');
  assert.strictEqual(meta.author, 'Reporter');
});

test('extractFromTwitterCards gets twitter:title and creator', () => {
  const meta = extractFromTwitterCards({
    querySelector: (sel) => {
      const map = {
        'meta[name="twitter:title"]': { content: 'Twitter Title' },
        'meta[property="twitter:title"]': null,
        'meta[name="twitter:creator"]': { content: '@journalist' },
        'meta[property="twitter:creator"]': null,
      };
      return map[sel] || null;
    }
  });
  assert.strictEqual(meta.title, 'Twitter Title');
  assert.strictEqual(meta.author, '@journalist');
});

test('extractFromHeuristics uses document.title and canonical', () => {
  const meta = extractFromHeuristics({
    title: 'Page Title - Site Name',
    querySelector: (sel) => {
      if (sel === 'h1') return { textContent: 'H1 Title' };
      if (sel === 'link[rel="canonical"]') return { href: 'https://example.com/canonical' };
      return null;
    },
    location: { href: 'https://example.com/page' }
  });
  assert.strictEqual(meta.title, 'Page Title - Site Name');
  assert.strictEqual(meta.url, 'https://example.com/canonical');
});

test('mergeMetadata uses priority order', () => {
  const og = { title: 'OG Title', author: null, siteName: 'OG Site', url: 'https://og.com' };
  const jsonLd = { title: 'LD Title', author: 'LD Author', siteName: null, url: null };
  const twitter = { title: null, author: '@twitter_user', siteName: null, url: null };
  const heuristic = { title: 'Heuristic', author: null, siteName: null, url: 'https://fallback.com' };

  const merged = mergeMetadata(og, jsonLd, twitter, heuristic);
  assert.strictEqual(merged.title, 'OG Title');
  assert.strictEqual(merged.author, 'LD Author');
  assert.strictEqual(merged.siteName, 'OG Site');
  assert.strictEqual(merged.url, 'https://og.com');
});
