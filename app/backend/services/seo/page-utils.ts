import type { PageAsset, PageAssetType } from '../../../shared/types/jobs';

export function normalizeAnalysisUrl(input: string): string {
  return input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
}

export function sanitizeDomain(input: string): string {
  return input.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0] ?? input;
}

export function resolveAssetUrl(baseUrl: string, value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return undefined;
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
}

export function isSameOrigin(baseUrl: string, targetUrl?: string): boolean {
  if (!targetUrl) {
    return true;
  }

  try {
    return new URL(baseUrl).origin === new URL(targetUrl).origin;
  } catch {
    return false;
  }
}

export function inferAssetTypeFromUrl(url?: string): PageAssetType {
  if (!url) {
    return 'other';
  }

  const pathname = safePathname(url).toLowerCase();

  if (pathname.endsWith('.css')) {
    return 'stylesheet';
  }
  if (pathname.match(/\.(js|mjs|cjs)(\?|$)/)) {
    return 'script';
  }
  if (pathname.match(/\.(png|jpe?g|gif|webp|svg|avif|ico)(\?|$)/)) {
    return 'image';
  }
  if (pathname.match(/\.(woff2?|ttf|otf|eot)(\?|$)/)) {
    return 'font';
  }

  return 'other';
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function inferAssetTypeFromContentType(contentType?: string): PageAssetType | undefined {
  if (!contentType) {
    return undefined;
  }

  const normalized = contentType.toLowerCase();
  if (normalized.includes('text/css')) {
    return 'stylesheet';
  }
  if (normalized.includes('javascript')) {
    return 'script';
  }
  if (normalized.startsWith('image/')) {
    return 'image';
  }
  if (normalized.includes('font/') || normalized.includes('woff') || normalized.includes('ttf')) {
    return 'font';
  }

  return undefined;
}

async function probeAsset(url: string): Promise<{ sizeBytes?: number; type?: PageAssetType }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return {};
    }

    const contentLength = response.headers.get('content-length');
    const parsedLength = contentLength ? Number.parseInt(contentLength, 10) : Number.NaN;
    return {
      sizeBytes: Number.isFinite(parsedLength) && parsedLength > 0 ? parsedLength : undefined,
      type: inferAssetTypeFromContentType(response.headers.get('content-type') ?? undefined),
    };
  } catch {
    return {};
  }
}

export async function enrichAssetsWithSize(assets: PageAsset[], sampleLimit = 12): Promise<PageAsset[]> {
  const candidates = assets.filter((asset) => !asset.inline && asset.url);
  const uniqueUrls = [...new Set(candidates.map((asset) => asset.url!).filter(Boolean))].slice(0, sampleLimit);

  const probeResults = await Promise.all(uniqueUrls.map(async (url) => [url, await probeAsset(url)] as const));
  const resultMap = new Map(probeResults);

  return assets.map((asset) => {
    if (asset.inline || !asset.url) {
      return asset;
    }

    const probe = resultMap.get(asset.url);
    if (!probe) {
      return asset;
    }

    return {
      ...asset,
      type: probe.type ?? asset.type,
      sizeBytes: probe.sizeBytes ?? asset.sizeBytes,
      sizeKnown: probe.sizeBytes !== undefined || asset.sizeKnown,
    };
  });
}
