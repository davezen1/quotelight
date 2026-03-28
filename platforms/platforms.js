export function buildShareText(quote, meta) {
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

export function truncateQuote(quote, url, limit) {
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

export const PLATFORMS = {
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
