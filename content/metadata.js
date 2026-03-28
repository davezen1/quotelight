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
        data = data.find(d => ['Article', 'NewsArticle', 'BlogPosting'].includes(d['@type']));
      }
      if (!data) continue;
      const type = data['@type'];
      if (!['Article', 'NewsArticle', 'BlogPosting'].includes(type)) continue;
      result.title = data.headline || null;
      if (data.author) {
        result.author = typeof data.author === 'string' ? data.author : data.author.name || null;
      }
      if (data.publisher) {
        result.siteName = typeof data.publisher === 'string' ? data.publisher : data.publisher.name || null;
      }
      break;
    } catch { /* Invalid JSON-LD, skip */ }
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
