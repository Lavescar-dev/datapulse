import type { HealthCheckResult, SSLInfo } from '../../../shared/types/monitor';

/**
 * Pinger service for checking API endpoint health
 */
export class PingerService {
  /**
   * Ping an endpoint and measure response time
   */
  async ping(url: string, method: 'GET' | 'POST' | 'HEAD' = 'GET'): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        signal: AbortSignal.timeout(10000), // 10 second timeout
        headers: {
          'User-Agent': 'DataPulse-Monitor/1.0',
        },
      });

      const responseTime = Date.now() - startTime;

      return {
        timestamp: new Date().toISOString(),
        statusCode: response.status,
        responseTime,
        isUp: response.status >= 200 && response.status < 500,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        timestamp: new Date().toISOString(),
        statusCode: null,
        responseTime: null,
        isUp: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check SSL certificate information
   */
  async checkSSL(url: string): Promise<SSLInfo> {
    try {
      // Parse URL to get hostname
      const urlObj = new URL(url);

      // Only check HTTPS URLs
      if (urlObj.protocol !== 'https:') {
        return { valid: false };
      }

      // Try to fetch the URL to check if SSL is valid
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });

      // If we got here, SSL is valid (no cert errors)
      // Note: Bun/Node doesn't provide direct access to certificate details
      // In a production environment, you'd use the 'tls' module for detailed cert info

      return {
        valid: response.ok || response.status < 500,
        issuer: 'Unknown',
        validFrom: undefined,
        validTo: undefined,
        daysRemaining: undefined,
      };
    } catch (error) {
      // SSL errors will be caught here
      if (error instanceof Error && error.message.includes('certificate')) {
        return {
          valid: false,
          issuer: undefined,
          validFrom: undefined,
          validTo: undefined,
          daysRemaining: 0,
        };
      }

      return { valid: false };
    }
  }

  /**
   * Batch ping multiple endpoints
   */
  async batchPing(
    endpoints: Array<{ url: string; method?: 'GET' | 'POST' | 'HEAD' }>
  ): Promise<HealthCheckResult[]> {
    const promises = endpoints.map(endpoint =>
      this.ping(endpoint.url, endpoint.method || 'GET')
    );

    return Promise.all(promises);
  }
}

export const pingerService = new PingerService();
