// Meta tags extractor service
import * as cheerio from 'cheerio';
import type { HeadingCounts, MetaTags, PageAsset } from '../../../shared/types/jobs';
import { enrichAssetsWithSize, inferAssetTypeFromUrl, isSameOrigin, normalizeAnalysisUrl, resolveAssetUrl } from './page-utils';

export async function extractMetaTags(url: string): Promise<MetaTags | undefined> {
  try {
    const fullUrl = normalizeAnalysisUrl(url);
    const startTime = Date.now();
    const response = await fetch(fullUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const fetchTimeMs = Date.now() - startTime;
    const html = await response.text();
    const $ = cheerio.load(html);
    const finalUrl = response.url || fullUrl;

    const headingCounts: HeadingCounts = {
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length,
      h4: $('h4').length,
      h5: $('h5').length,
      h6: $('h6').length,
    };

    const meta: MetaTags = {
      title: $('title').first().text().trim() || undefined,
      description: $('meta[name="description"]').attr('content')?.trim() || undefined,
      keywords: $('meta[name="keywords"]').attr('content')?.trim() || undefined,
      ogTitle: $('meta[property="og:title"]').attr('content')?.trim() || undefined,
      ogDescription: $('meta[property="og:description"]').attr('content')?.trim() || undefined,
      ogImage: resolveAssetUrl(finalUrl, $('meta[property="og:image"]').attr('content')?.trim()),
      ogType: $('meta[property="og:type"]').attr('content')?.trim() || undefined,
      twitterCard: $('meta[name="twitter:card"]').attr('content')?.trim() || undefined,
      twitterTitle: $('meta[name="twitter:title"]').attr('content')?.trim() || undefined,
      twitterDescription: $('meta[name="twitter:description"]').attr('content')?.trim() || undefined,
      twitterImage: resolveAssetUrl(finalUrl, $('meta[name="twitter:image"]').attr('content')?.trim()),
      canonical: resolveAssetUrl(finalUrl, $('link[rel="canonical"]').attr('href')?.trim()),
      robots: $('meta[name="robots"]').attr('content')?.trim() || undefined,
      finalUrl,
      statusCode: response.status,
      contentType: response.headers.get('content-type') ?? undefined,
      lang: $('html').attr('lang')?.trim() || undefined,
      charset: $('meta[charset]').attr('charset')?.trim() || $('meta[http-equiv="content-type"]').attr('content')?.match(/charset=([^;\s]+)/i)?.[1],
      viewport: $('meta[name="viewport"]').attr('content')?.trim() || undefined,
      favicon: resolveAssetUrl(finalUrl, $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href')?.trim()),
      htmlBytes: new TextEncoder().encode(html).length,
      textBytes: new TextEncoder().encode($.text().replace(/\s+/g, ' ').trim()).length,
      wordCount: countWords($('body').text()),
      fetchTimeMs,
      headingCounts,
      h1: $('h1').map((_, element) => $(element).text().trim()).get().filter(Boolean).slice(0, 5),
      images: {
        total: $('img').length,
        withoutAlt: $('img').filter((_, element) => !$(element).attr('alt')?.trim()).length,
      },
      links: extractLinks($, finalUrl),
    };

    const schemaScripts: unknown[] = [];
    const schemaTypes = new Set<string>();

    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const content = $(element).html();
        if (!content) {
          return;
        }
        const schema = JSON.parse(content);
        schemaScripts.push(schema);
        for (const type of collectSchemaTypes(schema)) {
          schemaTypes.add(type);
        }
      } catch {
        // Ignore invalid JSON-LD blocks.
      }
    });

    if (schemaScripts.length > 0) {
      meta.schemaOrg = schemaScripts;
    }
    if (schemaTypes.size > 0) {
      meta.schemaTypes = [...schemaTypes];
    }

    const assets = await enrichAssetsWithSize(extractAssets($, finalUrl), 12);
    if (assets.length > 0) {
      meta.assets = assets;
    }

    return meta;
  } catch (error) {
    console.error(`Meta tag extraction failed for ${url}:`, error);
    return undefined;
  }
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): NonNullable<MetaTags['links']> {
  let internal = 0;
  let external = 0;
  let missingAnchorText = 0;

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    const resolved = resolveAssetUrl(baseUrl, href);
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    const ariaLabel = $(element).attr('aria-label')?.trim();

    if (!text && !ariaLabel) {
      missingAnchorText += 1;
    }

    if (resolved && isSameOrigin(baseUrl, resolved)) {
      internal += 1;
    } else if (resolved) {
      external += 1;
    }
  });

  return {
    total: internal + external,
    internal,
    external,
    missingAnchorText,
  };
}

function extractAssets($: cheerio.CheerioAPI, baseUrl: string): PageAsset[] {
  const assets: PageAsset[] = [];

  $('script').each((_, element) => {
    const src = $(element).attr('src');
    const resolved = resolveAssetUrl(baseUrl, src);
    const inlineContent = $(element).html() ?? '';
    const inline = !resolved;
    const sizeBytes = inline ? new TextEncoder().encode(inlineContent).length : undefined;
    assets.push({
      type: resolved ? inferAssetTypeFromUrl(resolved) : 'script',
      url: resolved,
      inline,
      async: $(element).attr('async') !== undefined,
      defer: $(element).attr('defer') !== undefined,
      renderBlocking: !($(element).attr('async') !== undefined || $(element).attr('defer') !== undefined),
      sizeBytes,
      sizeKnown: inline,
    });
  });

  $('link[rel]').each((_, element) => {
    const rel = ($(element).attr('rel') ?? '').toLowerCase();
    const href = $(element).attr('href');
    const resolved = resolveAssetUrl(baseUrl, href);
    if (!resolved) {
      return;
    }

    if (rel.includes('stylesheet')) {
      assets.push({
        type: 'stylesheet',
        url: resolved,
        inline: false,
        renderBlocking: !rel.includes('preload'),
        sizeKnown: false,
      });
      return;
    }

    if (rel.includes('preload') || rel.includes('icon')) {
      assets.push({
        type: inferAssetTypeFromUrl(resolved),
        url: resolved,
        inline: false,
        renderBlocking: false,
        sizeKnown: false,
      });
    }
  });

  $('img[src]').each((_, element) => {
    const resolved = resolveAssetUrl(baseUrl, $(element).attr('src'));
    if (!resolved) {
      return;
    }
    assets.push({
      type: 'image',
      url: resolved,
      inline: false,
      renderBlocking: false,
      sizeKnown: false,
    });
  });

  return dedupeAssets(assets);
}

function dedupeAssets(assets: PageAsset[]): PageAsset[] {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.type}:${asset.url ?? `inline:${asset.sizeBytes ?? 0}`}:${asset.async ? 'a' : ''}${asset.defer ? 'd' : ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function collectSchemaTypes(input: unknown): string[] {
  if (!input || typeof input !== 'object') {
    return [];
  }

  const record = input as Record<string, unknown>;
  const directType = record['@type'];
  const graph = record['@graph'];
  const types: string[] = [];

  if (typeof directType === 'string') {
    types.push(directType);
  } else if (Array.isArray(directType)) {
    for (const value of directType) {
      if (typeof value === 'string') {
        types.push(value);
      }
    }
  }

  if (Array.isArray(graph)) {
    for (const item of graph) {
      types.push(...collectSchemaTypes(item));
    }
  }

  return types;
}

function countWords(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.split(' ').length : 0;
}
