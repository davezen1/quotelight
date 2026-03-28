// SelectShare - auto-generated bundle
(function() {

// --- platforms/platforms.js ---
function buildShareText(quote, meta) {
  const parts = [`"${quote}"`];
  const attribution = buildAttribution(meta);
  if (attribution) parts.push(attribution);
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

function truncateQuote(quote, url, limit) {
  const urlPart = `\n\n${url}`;
  const available = limit - urlPart.length;
  if (quote.length + 2 <= available) return `"${quote}"${urlPart}`;
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

const PLATFORMS = {
  x: {
    name: 'X', icon: '\u{1D54F}', color: '#000000', charLimit: 280,
    buildUrl(quote, meta) {
      return `https://x.com/intent/post?text=${encodeURIComponent(buildTruncatedShareText(quote, meta, 280))}`;
    }
  },
  facebook: {
    name: 'Facebook', icon: 'f', color: '#1877F2', charLimit: null,
    buildUrl(quote, meta) {
      return `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(buildShareText(quote, meta))}&u=${encodeURIComponent(meta.url)}`;
    }
  },
  linkedin: {
    name: 'LinkedIn', icon: 'in', color: '#0A66C2', charLimit: null,
    buildUrl(_quote, meta) {
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(meta.url)}`;
    }
  },
  reddit: {
    name: 'Reddit', icon: 'r', color: '#FF4500', charLimit: 300,
    buildUrl(quote, meta) {
      const title = `"${quote.length > 250 ? quote.slice(0, 247) + '...' : quote}"`;
      return `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(meta.url)}`;
    }
  },
  mastodon: {
    name: 'Mastodon', icon: 'M', color: '#6364FF', charLimit: 500, needsInstance: true,
    buildUrl(quote, meta, instanceUrl) {
      return `https://${instanceUrl}/share?text=${encodeURIComponent(buildTruncatedShareText(quote, meta, 500))}`;
    }
  },
  bluesky: {
    name: 'Bluesky', icon: '\u{1F98B}', color: '#0085FF', charLimit: 300,
    buildUrl(quote, meta) {
      return `https://bsky.app/intent/compose?text=${encodeURIComponent(buildTruncatedShareText(quote, meta, 300))}`;
    }
  },
  whatsapp: {
    name: 'WhatsApp', icon: 'W', color: '#25D366', charLimit: null,
    buildUrl(quote, meta) {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(buildShareText(quote, meta))}`;
    }
  },
  telegram: {
    name: 'Telegram', icon: 'T', color: '#26A5E4', charLimit: null,
    buildUrl(quote, meta) {
      return `https://t.me/share/url?url=${encodeURIComponent(meta.url)}&text=${encodeURIComponent(buildShareText(quote, meta))}`;
    }
  },
  email: {
    name: 'Email', icon: '\u2709', color: '#555555', charLimit: null,
    buildUrl(quote, meta) {
      const subjectQuote = quote.length > 60 ? quote.slice(0, 57) + '...' : quote;
      return `mailto:?subject=${encodeURIComponent(`"${subjectQuote}"`)}&body=${encodeURIComponent(buildShareText(quote, meta))}`;
    }
  }
};

// --- content/metadata.js ---
let cachedMetadata = null;
let cachedUrl = null;

function extractFromOpenGraph(doc) {
  const get = (sel) => doc.querySelector(sel)?.content || null;
  return {
    title: get('meta[property="og:title"]'),
    url: get('meta[property="og:url"]'),
    siteName: get('meta[property="og:site_name"]'),
    author: get('meta[name="author"]')
  };
}

function extractFromJsonLd(doc) {
  const result = { title: null, author: null, siteName: null, url: null };
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      let data = JSON.parse(script.textContent);
      if (Array.isArray(data)) {
        data = data.find(d => ['Article', 'NewsArticle', 'BlogPosting'].includes(d['@type']));
      }
      if (!data) continue;
      const type = data['@type'];
      if (!['Article', 'NewsArticle', 'BlogPosting'].includes(type)) continue;
      result.title = data.headline || null;
      if (data.author) {
        let author = data.author;
        if (Array.isArray(author)) author = author[0];
        result.author = typeof author === 'string' ? author : author?.name || null;
      }
      if (data.publisher) {
        result.siteName = typeof data.publisher === 'string' ? data.publisher : data.publisher.name || null;
      }
      break;
    } catch { /* Invalid JSON-LD, skip */ }
  }
  return result;
}

function extractFromTwitterCards(doc) {
  const get = (sel) => doc.querySelector(sel)?.content || null;
  return {
    title: get('meta[name="twitter:title"]') || get('meta[property="twitter:title"]'),
    author: get('meta[name="twitter:creator"]') || get('meta[property="twitter:creator"]'),
    siteName: null,
    url: null
  };
}

function extractFromHeuristics(doc) {
  const canonical = doc.querySelector('link[rel="canonical"]');
  return {
    title: doc.title || null,
    author: null,
    siteName: null,
    url: canonical?.href || doc.location?.href || null
  };
}

function mergeMetadata(og, jsonLd, twitter, heuristic) {
  return {
    title: og.title || jsonLd.title || twitter.title || heuristic.title || null,
    author: og.author || jsonLd.author || twitter.author || heuristic.author || null,
    siteName: og.siteName || jsonLd.siteName || twitter.siteName || heuristic.siteName || null,
    url: og.url || jsonLd.url || twitter.url || heuristic.url || null
  };
}

function getMetadata(doc) {
  const currentUrl = doc.location?.href;
  if (cachedMetadata && cachedUrl === currentUrl) return cachedMetadata;
  const og = extractFromOpenGraph(doc);
  const jsonLd = extractFromJsonLd(doc);
  const twitter = extractFromTwitterCards(doc);
  const heuristic = extractFromHeuristics(doc);
  cachedMetadata = mergeMetadata(og, jsonLd, twitter, heuristic);
  cachedUrl = currentUrl;
  return cachedMetadata;
}

// --- content/content.js ---
const VISIBLE_PLATFORM_COUNT = 5;
const QUOTE_PREVIEW_LIMIT = 120;

function truncateForPreview(text) {
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
      if (selection.rangeCount > 0) positionPopup(selection);
      popupEl.classList.add('visible');
    });
  }

  function hidePopup() {
    if (popupEl) popupEl.classList.remove('visible');
  }

  function handlePlatformClick(platformKey, quote, metadata) {
    if (platformKey === 'mastodon') {
      chrome.storage.local.get('mastodonInstance', (result) => {
        if (result.mastodonInstance && isValidInstance(result.mastodonInstance)) {
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
    if (popupHost && !popupHost.contains(e.target)) hidePopup();
  });
}

})();
