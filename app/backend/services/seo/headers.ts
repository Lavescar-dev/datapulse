// HTTP headers analyzer service
import type { HTTPHeaders } from '../../../shared/types/jobs';

export async function analyzeHeaders(url: string): Promise<HTTPHeaders | undefined> {
  try {
    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    const startTime = Date.now();
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
    });
    const loadTime = Date.now() - startTime;

    const headers: HTTPHeaders = {
      securityHeaders: {},
      caching: {},
    };

    // Server information
    const server = response.headers.get('server');
    if (server) headers.server = server;

    const poweredBy = response.headers.get('x-powered-by');
    if (poweredBy) headers.poweredBy = poweredBy;

    const contentType = response.headers.get('content-type');
    if (contentType) headers.contentType = contentType;

    // Security headers
    const hsts = response.headers.get('strict-transport-security');
    if (hsts) headers.securityHeaders.strictTransportSecurity = hsts;

    const csp = response.headers.get('content-security-policy');
    if (csp) headers.securityHeaders.contentSecurityPolicy = csp;

    const xFrame = response.headers.get('x-frame-options');
    if (xFrame) headers.securityHeaders.xFrameOptions = xFrame;

    const xContent = response.headers.get('x-content-type-options');
    if (xContent) headers.securityHeaders.xContentTypeOptions = xContent;

    const referrer = response.headers.get('referrer-policy');
    if (referrer) headers.securityHeaders.referrerPolicy = referrer;

    const permissions = response.headers.get('permissions-policy');
    if (permissions) headers.securityHeaders.permissionsPolicy = permissions;

    // Caching headers
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) headers.caching.cacheControl = cacheControl;

    const expires = response.headers.get('expires');
    if (expires) headers.caching.expires = expires;

    const etag = response.headers.get('etag');
    if (etag) headers.caching.etag = etag;

    // Compression
    const contentEncoding = response.headers.get('content-encoding');
    if (contentEncoding) headers.compression = contentEncoding;

    return headers;
  } catch (error) {
    console.error(`Headers analysis failed for ${url}:`, error);
    return undefined;
  }
}
