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
    popupHost.id = 'quotelight-host';
    document.body.appendChild(popupHost);
    shadowRoot = popupHost.attachShadow({ mode: 'closed' });
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('content/content.css');
    shadowRoot.appendChild(style);
    popupEl = document.createElement('div');
    popupEl.className = 'quotelight-popup';
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
    header.className = 'quotelight-header';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'QuoteLight';
    header.appendChild(label);
    popupEl.appendChild(header);

    // Quote section
    const quoteSection = document.createElement('div');
    quoteSection.className = 'quotelight-quote';
    const quoteText = document.createElement('p');
    quoteText.className = 'quote-text';
    quoteText.textContent = `\u201C${previewQuote}\u201D`;
    quoteSection.appendChild(quoteText);
    const attrLine = buildAttributionDom(metadata);
    if (attrLine) quoteSection.appendChild(attrLine);
    popupEl.appendChild(quoteSection);

    // Platform buttons
    const platformsContainer = document.createElement('div');
    platformsContainer.className = 'quotelight-platforms';
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
