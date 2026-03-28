# SelectShare — Chrome Extension Design Spec

## Overview

SelectShare is a Chrome extension that lets users highlight a quote from any webpage and share it — along with article metadata (title, author, publication) and a link — to social media platforms and messaging apps via a floating popup.

## Goals

- One-action sharing: highlight text → click platform → done
- Rich attribution: quote + article title + author + source + URL
- Works on any website, with smarter metadata extraction on article pages
- No accounts, no API keys, no stored data

## Architecture

A Manifest V3 Chrome extension with two components:

1. **Content Script** — injected into all pages via `matches: ["<all_urls>"]`. Handles text selection detection, page metadata extraction, popup rendering, and share intent URL construction.
2. **Shadow DOM Popup** — a floating card rendered inside a shadow root to isolate styles from the host page. Appears near the selected text with a quote preview, attribution line, and platform share icons.

No background service worker is needed for the core flow. The only use of `chrome.storage.local` is to persist the user's Mastodon instance URL (entered once on first Mastodon share).

### Permissions

- `activeTab` — read page content and selection
- `storage` — persist Mastodon instance URL
- Content script declared with `matches: ["<all_urls>"]`

No host permissions. No remote code. No external services.

## Metadata Extraction

When the user highlights text, the content script extracts article metadata using a priority chain (first match wins per field):

1. **Open Graph tags** — `og:title`, `og:url`, `og:site_name`, `meta[name="author"]`
2. **Schema.org JSON-LD** — `Article`, `NewsArticle`, or `BlogPosting` types → `headline`, `author.name`, `publisher.name`
3. **Twitter card meta tags** — `twitter:title`, `twitter:creator`
4. **HTML heuristics** — `document.title`, first `<h1>`, `<link rel="canonical">`, `window.location.href`

Extraction runs once per page load and caches the result in memory. The output is:

```js
{
  title: "Why Innovation Matters",     // may be absent
  author: "Jane Smith",                // may be absent
  siteName: "The Atlantic",            // may be absent
  url: "https://theatlantic.com/..."   // always present (falls back to window.location.href)
}
```

Missing fields are omitted from the share text — the format degrades gracefully.

## Share Text Format

The default share text template:

```
"The best ideas arise from a passionate commitment to the problem"

From "Why Innovation Matters" by Jane Smith — The Atlantic
https://theatlantic.com/article/...
```

Degraded examples:
- No author: `From "Why Innovation Matters" — The Atlantic`
- No author or site: `From "Why Innovation Matters"`
- No metadata at all: Just the quote + URL

## Platform Configurations

| Platform | Intent URL Pattern | Char Limit | Notes |
|----------|-------------------|------------|-------|
| X (Twitter) | `https://twitter.com/intent/tweet?text={text}` | 280 | Truncate quote with "…" if needed, always keep URL |
| Facebook | `https://www.facebook.com/sharer/sharer.php?quote={text}&u={url}` | No practical limit | URL generates link preview |
| LinkedIn | `https://www.linkedin.com/sharing/share-offsite/?url={url}` | 3000 | Full format |
| Reddit | `https://reddit.com/submit?title={title}&url={url}` | Title limit | Quote goes in title, article URL as the link |
| Mastodon | `https://{instance}/share?text={text}` | 500 | Prompt for instance URL on first use, save to `chrome.storage.local` |
| Bluesky | `https://bsky.app/intent/compose?text={text}` | 300 | Truncate quote if needed, always keep URL |
| WhatsApp | `https://api.whatsapp.com/send?text={text}` | No practical limit | Full format |
| Telegram | `https://t.me/share/url?url={url}&text={text}` | No practical limit | Full format |
| Email | `mailto:?subject={subject}&body={body}` | No limit | Truncated quote in subject, full format in body |

All sharing opens the intent URL in a new tab. No authentication required.

### Text Truncation Strategy

For platforms with character limits, the truncation priority is:
1. Always keep the URL (non-negotiable)
2. Keep the attribution line if it fits
3. Truncate the quote text with "…" to fit remaining space

## Popup UI

### Appearance

A compact card-style popup with:
- **Header**: "SelectShare" label
- **Quote preview**: The selected text in italics with a blue left border, truncated at ~120 characters
- **Attribution line**: Article title, author, and site name
- **Platform icons**: Branded colored squares (36×36px, 8px border-radius) in a row. Shows the top 4-5 platforms with a "•••" overflow button to reveal all 9.

### Positioning

- Appears directly below the text selection
- Small upward-pointing arrow connects popup to the selection
- If the selection is near the bottom of the viewport, the popup appears above instead

### Interaction

- **Show**: On `mouseup`, if text selection is non-empty (>3 characters)
- **Dismiss**: Click outside the popup, press Escape, or start a new selection
- **Animation**: Fade in with subtle scale-up (150ms ease-out)
- **Share**: Click a platform icon → compose share text → `window.open()` to intent URL in new tab

### Style Isolation

The popup is rendered inside a Shadow DOM element to prevent CSS conflicts with the host page. All styles are scoped within the shadow root.

## File Structure

```
selectshare/
├── manifest.json          # Manifest V3 configuration
├── content/
│   ├── content.js         # Selection detection, popup rendering, sharing
│   ├── content.css        # Popup styles (injected into shadow DOM)
│   └── metadata.js        # Page metadata extraction
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── platforms/
    └── platforms.js        # Platform configs: intent URLs, limits, formatters
```

### Key Technical Decisions

- **Vanilla JS, no framework** — keeps the extension small and fast with no build step
- **Shadow DOM** — isolates popup styles from any host page CSS
- **Config-driven platforms** — each platform is a plain object with its intent URL template, character limit, and format function, making it trivial to add or modify platforms
- **Manifest V3** — required for Chrome Web Store submissions
- **No build tooling** — plain JS/CSS, loadable as an unpacked extension during development

## Interaction Flow

1. User highlights text on any webpage
2. `mouseup` event fires → content script checks for valid text selection (>3 chars)
3. Metadata extraction runs (or returns cached result)
4. Popup renders in shadow DOM, positioned below selection
5. User clicks a platform icon
6. Share text is composed using platform-specific formatting and truncation
7. Intent URL opens in a new tab
8. Popup dismisses

## Edge Cases

- **No text selected / selection too short**: Popup does not appear
- **Selection inside iframes**: Not supported in v1 (content scripts don't inject into cross-origin iframes by default)
- **Very long selections**: Quote is truncated in the popup preview at ~120 chars and in share text per platform limits
- **Page with no metadata**: Share includes just the quote and the page URL
- **Mastodon first use**: Small inline prompt within the popup asks for the instance URL before sharing
- **Multiple rapid selections**: Previous popup is dismissed before showing the new one
- **Right-to-left text**: Popup layout remains LTR; quoted text preserves the page's text direction

## Out of Scope (v1)

- Share history / saved quotes
- Quote image/card generation
- Customizable platform order
- Keyboard shortcuts for sharing
- Firefox / Safari support
- Content script injection into iframes
