# SelectShare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that lets users highlight text on any webpage and share it with attribution to social media platforms via a floating popup.

**Architecture:** Manifest V3 Chrome extension with a content script injected on all pages. The content script detects text selection, extracts page metadata (OG tags, JSON-LD, heuristics), and renders a Shadow DOM popup with platform share icons that open intent URLs in new tabs.

**Tech Stack:** Vanilla JS, Chrome Extension Manifest V3, Shadow DOM, CSS

**Module strategy:** Content scripts loaded via `manifest.json` run as classic scripts (not ES modules), sharing the global scope. For testability, each file uses a dual-export pattern: functions are assigned to the global scope (`globalThis`) for browser use, and conditionally exported via a `typeof module` guard for Node test imports. Test files use dynamic `import()` with a shim that extracts from `globalThis` if needed. Alternatively, we use a simple approach: test files directly import using Node's ESM support, and the source files use `export` syntax. The `manifest.json` content scripts are switched to use `"type": "module"` (supported in Manifest V3) or we provide a thin loader wrapper.

**Chosen approach for modules:** Source files (`platforms.js`, `metadata.js`, `content.js`) are written as standard ES modules with `export`. For Chrome, the manifest uses `"type": "module"` on the content script entries (Manifest V3 supports this). Tests import directly using Node's native ESM (`node --test`). A `package.json` with `"type": "module"` enables this.

---

## File Map

| File | Responsibility |
|------|---------------|
| `manifest.json` | Extension manifest — permissions, content script registration |
| `platforms/platforms.js` | Platform config objects: name, icon, color, intent URL builder, char limit |
| `content/metadata.js` | Page metadata extraction (OG, JSON-LD, Twitter cards, heuristics) |
| `content/content.css` | All popup styles (injected into shadow root) |
| `content/content.js` | Selection detection, popup rendering, sharing orchestration |
| `build.js` | Simple bundler: concatenates source modules into `dist/selectshare.js` for Chrome |
| `dist/selectshare.js` | Auto-generated bundle loaded by Chrome (do not edit directly) |
| `icons/icon-16.png` | Extension toolbar icon 16px |
| `icons/icon-48.png` | Extension toolbar icon 48px |
| `icons/icon-128.png` | Extension toolbar icon 128px |
| `tests/platforms.test.js` | Tests for platform URL builders and text truncation |
| `tests/metadata.test.js` | Tests for metadata extraction |
| `tests/content.test.js` | Tests for share text composition and popup logic |

---

### Task 1: Project Scaffold and Manifest

**Files:**
- Create: `manifest.json`
- Create: `package.json`
- Create: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`

- [ ] **Step 1: Create package.json for ESM support**

```json
{
  "name": "selectshare",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Create manifest.json**

Note: Manifest V3 does not support `"type": "module"` for content scripts directly. Instead, we use a single entry-point loader script that dynamically imports the modules. However, the simplest working approach is to concatenate/bundle at dev time, or use the IIFE pattern. **Simplest approach chosen:** Write source as ES modules for tests. For Chrome, provide a `build.js` script that concatenates `platforms.js` + `metadata.js` + `content.js` into a single `dist/selectshare.js` file (stripping `export`/`import` keywords). This avoids build tooling complexity while keeping testability.

```json
{
  "manifest_version": 3,
  "name": "SelectShare",
  "version": "1.0.0",
  "description": "Highlight any quote and share it with attribution to social media.",
  "permissions": ["activeTab", "storage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/selectshare.js"],
      "css": []
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["content/content.css"],
      "matches": ["<all_urls>"]
    }
  ],
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 2: Create placeholder icons**

Generate simple colored square PNG icons at 16x16, 48x48, and 128x128 with "SS" text. Use a canvas-based Node script or any image tool.

- [ ] **Step 3: Create build.js script**

Create `build.js` -- a simple Node script that concatenates the source modules into a single IIFE for Chrome:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const files = [
  'platforms/platforms.js',
  'content/metadata.js',
  'content/content.js'
];

mkdirSync('dist', { recursive: true });

let output = '// SelectShare - auto-generated bundle\n';
output += '(function() {\n';

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  // Strip ES module syntax (export/import) for browser bundle
  content = content.replace(/^export\s+/gm, '');
  content = content.replace(/^import\s+.*;\s*$/gm, '');
  output += `\n// --- ${file} ---\n`;
  output += content;
}

output += '\n})();\n';
writeFileSync('dist/selectshare.js', output);
console.log('Built dist/selectshare.js');
```

Run: `node build.js`
Expected: Creates `dist/selectshare.js` (will be mostly empty until source files exist)

- [ ] **Step 4: Verify extension loads**

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" -> select the `selectshare/` directory
4. Expected: Extension appears in the list with no errors

- [ ] **Step 5: Commit**

```bash
git add manifest.json package.json build.js icons/
git commit -m "feat: scaffold project with manifest, build script, and placeholder icons"
```

---

### Task 2: Platform Configurations

**Files:**
- Create: `platforms/platforms.js`
- Create: `tests/platforms.test.js`

- [ ] **Step 1: Write failing tests for platform URL builders**

Create `tests/platforms.test.js` using Node's built-in test runner:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/platforms.test.js`
Expected: All tests fail (module not found)

- [ ] **Step 3: Implement platforms.js**

Create `platforms/platforms.js`:

```js
/**
 * Builds the full share text with quote, attribution, and URL.
 * Degrades gracefully when metadata fields are missing.
 */
export function buildShareText(quote, meta) {
  const parts = [`"${quote}"`];

  const attribution = buildAttribution(meta);
  if (attribution) {
    parts.push(attribution);
  }

  parts.push(meta.url);
  return parts.join('\n\n');
}

function buildAttribution(meta) {
  if (!meta.title && !meta.author && !meta.siteName) return null;

  let line = 'From';
  if (meta.title) line += ` "${meta.title}"`;
  if (meta.author) line += ` by ${meta.author}`;
  if (meta.siteName) line += ` -- ${meta.siteName}`;
  return line;
}

/**
 * Truncates share text to fit within a character limit.
 * Priority: always keep URL, then attribution, then truncate quote.
 */
export function truncateQuote(quote, url, limit) {
  const urlPart = `\n\n${url}`;
  const available = limit - urlPart.length;

  if (quote.length + 2 <= available) {
    return `"${quote}"${urlPart}`;
  }

  const truncated = quote.slice(0, available - 5) + '...';
  return `"${truncated}"${urlPart}`;
}

function buildTruncatedShareText(quote, meta, limit) {
  const full = buildShareText(quote, meta);
  if (full.length <= limit) return full;

  const attribution = buildAttribution(meta);
  const urlPart = `\n\n${meta.url}`;
  const attrPart = attribution ? `\n\n${attribution}` : '';
  const fixedLen = urlPart.length + attrPart.length;
  const available = limit - fixedLen;

  if (available > 10) {
    const truncated = quote.slice(0, available - 5) + '...';
    return `"${truncated}"${attrPart}${urlPart}`;
  }

  return truncateQuote(quote, meta.url, limit);
}

export const PLATFORMS = {
  x: {
    name: 'X',
    icon: '\u{1D54F}',
    color: '#000000',
    charLimit: 280,
    buildUrl(quote, meta) {
      const text = buildTruncatedShareText(quote, meta, 280);
      return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    }
  },
  facebook: {
    name: 'Facebook',
    icon: 'f',
    color: '#1877F2',
    charLimit: null,
    buildUrl(quote, meta) {
      const text = buildShareText(quote, meta);
      return `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}&u=${encodeURIComponent(meta.url)}`;
    }
  },
  linkedin: {
    name: 'LinkedIn',
    icon: 'in',
    color: '#0A66C2',
    charLimit: null,
    buildUrl(_quote, meta) {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(meta.url)}`;
    }
  },
  reddit: {
    name: 'Reddit',
    icon: 'r',
    color: '#FF4500',
    charLimit: 300,
    buildUrl(quote, meta) {
      const title = `"${quote.length > 250 ? quote.slice(0, 247) + '...' : quote}"`;
      return `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(meta.url)}`;
    }
  },
  mastodon: {
    name: 'Mastodon',
    icon: 'M',
    color: '#6364FF',
    charLimit: 500,
    needsInstance: true,
    buildUrl(quote, meta, instanceUrl) {
      const text = buildTruncatedShareText(quote, meta, 500);
      return `https://${instanceUrl}/share?text=${encodeURIComponent(text)}`;
    }
  },
  bluesky: {
    name: 'Bluesky',
    icon: '\u{1F98B}',
    color: '#0085FF',
    charLimit: 300,
    buildUrl(quote, meta) {
      const text = buildTruncatedShareText(quote, meta, 300);
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    }
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: 'W',
    color: '#25D366',
    charLimit: null,
    buildUrl(quote, meta) {
      const text = buildShareText(quote, meta);
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
  },
  telegram: {
    name: 'Telegram',
    icon: 'T',
    color: '#26A5E4',
    charLimit: null,
    buildUrl(quote, meta) {
      const text = buildShareText(quote, meta);
      return `https://t.me/share/url?url=${encodeURIComponent(meta.url)}&text=${encodeURIComponent(text)}`;
    }
  },
  email: {
    name: 'Email',
    icon: '\u2709',
    color: '#555555',
    charLimit: null,
    buildUrl(quote, meta) {
      const subjectQuote = quote.length > 60 ? quote.slice(0, 57) + '...' : quote;
      const subject = `"${subjectQuote}"`;
      const body = buildShareText(quote, meta);
      return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/platforms.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add platforms/ tests/platforms.test.js
git commit -m "feat: add platform configs with share text builder and truncation"
```

---

### Task 3: Metadata Extraction

**Files:**
- Create: `content/metadata.js`
- Create: `tests/metadata.test.js`

- [ ] **Step 1: Write failing tests for metadata extraction**

Create `tests/metadata.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/metadata.test.js`
Expected: All tests fail (module not found)

- [ ] **Step 3: Implement metadata.js**

Create `content/metadata.js`:

```js
/**
 * Metadata extraction for article pages.
 * Uses a priority chain: OG tags > JSON-LD > Twitter cards > HTML heuristics.
 * Results are cached per page load.
 */

let cachedMetadata = null;

export function extractFromOpenGraph(doc) {
  const get = (sel) => doc.querySelector(sel)?.content || null;
  return {
    title: get('meta[property="og:title"]'),
    url: get('meta[property="og:url"]'),
    siteName: get('meta[property="og:site_name"]'),
    author: get('meta[name="author"]')
  };
}

export function extractFromJsonLd(doc) {
  const result = { title: null, author: null, siteName: null, url: null };
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);
      if (Array.isArray(data)) {
        data = data.find(d =>
          ['Article', 'NewsArticle', 'BlogPosting'].includes(d['@type'])
        );
      }
      if (!data) continue;

      const type = data['@type'];
      if (!['Article', 'NewsArticle', 'BlogPosting'].includes(type)) continue;

      result.title = data.headline || null;
      if (data.author) {
        result.author = typeof data.author === 'string'
          ? data.author
          : data.author.name || null;
      }
      if (data.publisher) {
        result.siteName = typeof data.publisher === 'string'
          ? data.publisher
          : data.publisher.name || null;
      }
      break;
    } catch {
      // Invalid JSON-LD, skip
    }
  }
  return result;
}

export function extractFromTwitterCards(doc) {
  const get = (sel) => doc.querySelector(sel)?.content || null;
  return {
    title: get('meta[name="twitter:title"]') || get('meta[property="twitter:title"]'),
    author: get('meta[name="twitter:creator"]') || get('meta[property="twitter:creator"]'),
    siteName: null,
    url: null
  };
}

export function extractFromHeuristics(doc) {
  const canonical = doc.querySelector('link[rel="canonical"]');
  return {
    title: doc.title || null,
    author: null,
    siteName: null,
    url: canonical?.href || doc.location?.href || null
  };
}

export function mergeMetadata(og, jsonLd, twitter, heuristic) {
  return {
    title: og.title || jsonLd.title || twitter.title || heuristic.title || null,
    author: og.author || jsonLd.author || twitter.author || heuristic.author || null,
    siteName: og.siteName || jsonLd.siteName || twitter.siteName || heuristic.siteName || null,
    url: og.url || jsonLd.url || twitter.url || heuristic.url || null
  };
}

export function getMetadata(doc) {
  if (cachedMetadata) return cachedMetadata;

  const og = extractFromOpenGraph(doc);
  const jsonLd = extractFromJsonLd(doc);
  const twitter = extractFromTwitterCards(doc);
  const heuristic = extractFromHeuristics(doc);

  cachedMetadata = mergeMetadata(og, jsonLd, twitter, heuristic);
  return cachedMetadata;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/metadata.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add content/metadata.js tests/metadata.test.js
git commit -m "feat: add metadata extraction with OG, JSON-LD, Twitter, heuristic fallbacks"
```

---

### Task 4: Popup Styles

**Files:**
- Create: `content/content.css`

- [ ] **Step 1: Create popup stylesheet**

Create `content/content.css` with all styles scoped to the shadow DOM:

```css
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
}

.selectshare-popup {
  position: fixed;
  z-index: 2147483647;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  width: 320px;
  overflow: hidden;
  opacity: 0;
  transform: scale(0.95);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
  pointer-events: none;
}

.selectshare-popup.visible {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.selectshare-popup .arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #fff;
  transform: rotate(45deg);
  box-shadow: -2px -2px 4px rgba(0, 0, 0, 0.05);
}

.selectshare-popup .arrow.up {
  top: -6px;
  left: 24px;
}

.selectshare-popup .arrow.down {
  bottom: -6px;
  left: 24px;
  box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.05);
}

.selectshare-header {
  padding: 10px 14px 6px;
  border-bottom: 1px solid #eee;
}

.selectshare-header .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.selectshare-quote {
  padding: 10px 14px;
}

.selectshare-quote .quote-text {
  font-size: 13px;
  color: #333;
  line-height: 1.5;
  font-style: italic;
  border-left: 3px solid #2d7ff9;
  padding-left: 10px;
  margin: 0;
}

.selectshare-quote .attribution {
  font-size: 11px;
  color: #888;
  margin-top: 6px;
}

.selectshare-quote .attribution strong {
  color: #555;
}

.selectshare-platforms {
  padding: 8px 14px 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.selectshare-platforms .platform-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  transition: transform 100ms ease, opacity 100ms ease;
  padding: 0;
}

.selectshare-platforms .platform-btn:hover {
  transform: scale(1.1);
  opacity: 0.9;
}

.selectshare-platforms .more-btn {
  background: #ddd;
  color: #666;
  font-size: 14px;
}

.selectshare-platforms.expanded .more-btn {
  display: none;
}

.selectshare-platforms .platform-btn.overflow {
  display: none;
}

.selectshare-platforms.expanded .platform-btn.overflow {
  display: flex;
}

.mastodon-prompt {
  padding: 8px 14px 12px;
  display: none;
}

.mastodon-prompt.visible {
  display: block;
}

.mastodon-prompt label {
  font-size: 12px;
  color: #555;
  display: block;
  margin-bottom: 4px;
}

.mastodon-prompt input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.mastodon-prompt .prompt-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.mastodon-prompt .prompt-actions button {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #ccc;
  cursor: pointer;
  font-size: 12px;
  background: #fff;
}

.mastodon-prompt .prompt-actions button.primary {
  background: #6364FF;
  color: #fff;
  border-color: #6364FF;
}
```

- [ ] **Step 2: Commit**

```bash
git add content/content.css
git commit -m "feat: add popup styles for shadow DOM"
```

---

### Task 5: Content Script -- Selection Detection and Popup Rendering

**Files:**
- Create: `content/content.js`
- Create: `tests/content.test.js`

**Security note:** All DOM construction uses safe methods (`createElement`, `textContent`, `appendChild`). No `innerHTML` is used anywhere -- this prevents XSS from malicious page content being injected into the popup.

- [ ] **Step 1: Write failing tests for quote preview truncation**

Create `tests/content.test.js`:

```js
import assert from 'node:assert';
import { test } from 'node:test';
import { truncateForPreview } from '../content/content.js';

test('truncateForPreview leaves short text intact', () => {
  const result = truncateForPreview('Short quote');
  assert.strictEqual(result, 'Short quote');
});

test('truncateForPreview truncates at ~120 chars', () => {
  const longText = 'A'.repeat(200);
  const result = truncateForPreview(longText);
  assert.ok(result.length <= 121);
  assert.ok(result.endsWith('\u2026'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/content.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement content.js using safe DOM methods**

Create `content/content.js`. All popup DOM is built with `createElement`/`textContent`/`appendChild` -- never `innerHTML`:

```js
/**
 * SelectShare Content Script
 * Detects text selection, renders share popup in Shadow DOM.
 * All DOM construction uses safe methods (no innerHTML).
 */

const VISIBLE_PLATFORM_COUNT = 5;
const QUOTE_PREVIEW_LIMIT = 120;

export function truncateForPreview(text) {
  if (text.length <= QUOTE_PREVIEW_LIMIT) return text;
  return text.slice(0, QUOTE_PREVIEW_LIMIT) + '\u2026';
}

// --- Browser-only code below (guarded for testability) ---

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  let popupHost = null;
  let shadowRoot = null;
  let popupEl = null;

  function initPopup() {
    popupHost = document.createElement('div');
    popupHost.id = 'selectshare-host';
    document.body.appendChild(popupHost);

    shadowRoot = popupHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('content/content.css');
    shadowRoot.appendChild(style);

    popupEl = document.createElement('div');
    popupEl.className = 'selectshare-popup';
    shadowRoot.appendChild(popupEl);
  }

  function buildPopupDom(quote, metadata) {
    const previewQuote = truncateForPreview(quote);

    // Clear previous content
    while (popupEl.firstChild) popupEl.removeChild(popupEl.firstChild);

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'arrow up';
    popupEl.appendChild(arrow);

    // Header
    const header = document.createElement('div');
    header.className = 'selectshare-header';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'SelectShare';
    header.appendChild(label);
    popupEl.appendChild(header);

    // Quote section
    const quoteSection = document.createElement('div');
    quoteSection.className = 'selectshare-quote';

    const quoteText = document.createElement('p');
    quoteText.className = 'quote-text';
    quoteText.textContent = `\u201C${previewQuote}\u201D`;
    quoteSection.appendChild(quoteText);

    const attrLine = buildAttributionDom(metadata);
    if (attrLine) quoteSection.appendChild(attrLine);

    popupEl.appendChild(quoteSection);

    // Platform buttons
    const platformsContainer = document.createElement('div');
    platformsContainer.className = 'selectshare-platforms';

    const platformEntries = Object.entries(PLATFORMS);
    platformEntries.forEach(([key, platform], i) => {
      const btn = document.createElement('button');
      btn.className = 'platform-btn' + (i >= VISIBLE_PLATFORM_COUNT ? ' overflow' : '');
      btn.dataset.platform = key;
      btn.style.background = platform.color;
      btn.title = platform.name;
      btn.textContent = platform.icon;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePlatformClick(key, quote, metadata);
      });
      platformsContainer.appendChild(btn);
    });

    if (platformEntries.length > VISIBLE_PLATFORM_COUNT) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'platform-btn more-btn';
      moreBtn.title = 'More platforms';
      moreBtn.textContent = '\u2022\u2022\u2022';
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        platformsContainer.classList.add('expanded');
      });
      platformsContainer.appendChild(moreBtn);
    }

    popupEl.appendChild(platformsContainer);

    // Mastodon instance prompt
    const mastodonPrompt = document.createElement('div');
    mastodonPrompt.className = 'mastodon-prompt';

    const promptLabel = document.createElement('label');
    promptLabel.textContent = 'Your Mastodon instance:';
    mastodonPrompt.appendChild(promptLabel);

    const promptInput = document.createElement('input');
    promptInput.type = 'text';
    promptInput.placeholder = 'mastodon.social';
    mastodonPrompt.appendChild(promptInput);

    const promptActions = document.createElement('div');
    promptActions.className = 'prompt-actions';

    const goBtn = document.createElement('button');
    goBtn.className = 'primary';
    goBtn.textContent = 'Share';
    goBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const instance = promptInput.value.trim();
      if (isValidInstance(instance)) {
        chrome.storage.local.set({ mastodonInstance: instance });
        const url = PLATFORMS.mastodon.buildUrl(quote, metadata, instance);
        window.open(url, '_blank');
        hidePopup();
      }
    });
    promptActions.appendChild(goBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mastodonPrompt.classList.remove('visible');
    });
    promptActions.appendChild(cancelBtn);

    mastodonPrompt.appendChild(promptActions);
    popupEl.appendChild(mastodonPrompt);
  }

  function buildAttributionDom(meta) {
    if (!meta.title && !meta.author && !meta.siteName) return null;

    const div = document.createElement('div');
    div.className = 'attribution';

    let text = 'From';
    if (meta.title) {
      text += ' ';
      div.appendChild(document.createTextNode(text));
      const strong = document.createElement('strong');
      strong.textContent = `\u201C${meta.title}\u201D`;
      div.appendChild(strong);
      text = '';
    }
    if (meta.author) text += ` by ${meta.author}`;
    if (meta.siteName) text += ` \u2014 ${meta.siteName}`;
    if (text) div.appendChild(document.createTextNode(text));

    return div;
  }

  function isValidInstance(instance) {
    return /^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(instance);
  }

  function positionPopup(selection) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const popupHeight = popupEl.offsetHeight || 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < popupHeight + 20;

    const arrowEl = popupEl.querySelector('.arrow');

    if (showAbove) {
      popupEl.style.top = `${rect.top + window.scrollY - popupHeight - 10}px`;
      if (arrowEl) arrowEl.className = 'arrow down';
    } else {
      popupEl.style.top = `${rect.bottom + window.scrollY + 10}px`;
      if (arrowEl) arrowEl.className = 'arrow up';
    }

    popupEl.style.left = `${Math.max(10, rect.left + window.scrollX)}px`;
  }

  function showPopup(quote, metadata) {
    if (!popupEl) initPopup();

    buildPopupDom(quote, metadata);
    popupEl.classList.remove('visible');

    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        positionPopup(selection);
      }
      popupEl.classList.add('visible');
    });
  }

  function hidePopup() {
    if (popupEl) {
      popupEl.classList.remove('visible');
    }
  }

  function handlePlatformClick(platformKey, quote, metadata) {
    if (platformKey === 'mastodon') {
      chrome.storage.local.get('mastodonInstance', (result) => {
        if (result.mastodonInstance) {
          const url = PLATFORMS.mastodon.buildUrl(quote, metadata, result.mastodonInstance);
          window.open(url, '_blank');
          hidePopup();
        } else {
          popupEl.querySelector('.mastodon-prompt').classList.add('visible');
        }
      });
      return;
    }

    const platform = PLATFORMS[platformKey];
    if (!platform) return;

    const url = platform.buildUrl(quote, metadata);
    window.open(url, '_blank');
    hidePopup();
  }

  // --- Event listeners ---

  document.addEventListener('mouseup', (e) => {
    if (popupHost && popupHost.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();

      if (text && text.length > 3) {
        const metadata = getMetadata(document);
        showPopup(text, metadata);
      } else {
        hidePopup();
      }
    }, 10);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup();
  });

  document.addEventListener('mousedown', (e) => {
    if (popupHost && !popupHost.contains(e.target)) {
      hidePopup();
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/content.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content/content.js tests/content.test.js
git commit -m "feat: add content script with selection detection and safe DOM popup"
```

---

### Task 6: Build Bundle and Verify Extension

**Files:**
- Rebuild: `dist/selectshare.js`

- [ ] **Step 1: Run the build script**

```bash
node build.js
```

Expected: `dist/selectshare.js` is created with all three source files concatenated into an IIFE.

- [ ] **Step 2: Verify extension loads and works in Chrome**

1. Go to `chrome://extensions`
2. Click reload on SelectShare
3. Open any article page (e.g., theatlantic.com)
4. Highlight some text
5. Expected: Floating popup appears with quote preview and platform icons

- [ ] **Step 3: Commit**

```bash
git add dist/
git commit -m "feat: build initial extension bundle"
```

---

### Task 7: Manual End-to-End Testing

**Files:** None (testing only)

- [ ] **Step 1: Test on an article site (The Atlantic or similar)**

1. Navigate to an article with good metadata
2. Highlight a quote
3. Verify: popup appears with quote preview, title, author, site name
4. Click X icon -> verify intent URL opens with correct text
5. Click Facebook icon -> verify sharer URL opens
6. Click LinkedIn icon -> verify share URL opens with article link
7. Click Email icon -> verify mailto opens with subject and body

- [ ] **Step 2: Test on a plain page (e.g., a personal blog with no OG tags)**

1. Highlight text
2. Verify: popup shows quote + page URL (graceful degradation)

- [ ] **Step 3: Test edge cases**

1. Select fewer than 4 characters -> popup should NOT appear
2. Press Escape -> popup should dismiss
3. Click outside popup -> popup should dismiss
4. Select text near bottom of viewport -> popup should appear above
5. Click the more button -> remaining platform icons should appear

- [ ] **Step 4: Test Mastodon flow**

1. Click Mastodon icon -> instance URL prompt should appear
2. Enter `mastodon.social` -> should open share URL
3. Next Mastodon share -> should skip the prompt (instance saved)

- [ ] **Step 5: Commit any fixes**

```bash
# Stage only the specific files you modified
git add platforms/platforms.js content/metadata.js content/content.js content/content.css
node build.js && git add dist/selectshare.js
git commit -m "fix: address issues found during manual testing"
```

---

### Task 8: Extension Icons

**Files:**
- Modify: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png`

- [ ] **Step 1: Generate proper icons**

Create clean icons with the SelectShare branding -- a simple share/quote icon or stylized "SS" mark. Generate at 16x16, 48x48, and 128x128 PNG.

- [ ] **Step 2: Verify icons display correctly**

1. Reload extension in `chrome://extensions`
2. Check toolbar icon appears correctly
3. Check extension management page shows icon

- [ ] **Step 3: Commit**

```bash
git add icons/
git commit -m "feat: add final extension icons"
```
