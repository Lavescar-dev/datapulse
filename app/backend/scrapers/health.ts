/**
 * Scraper Health Monitoring
 * Tracks scraper performance, errors, and availability
 */

interface ScraperHealthMetrics {
  source: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageResponseTime: number;
  lastError?: string;
  lastSuccess?: Date;
}

interface HealthCheckResult {
  source: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

export class ScraperHealthMonitor {
  private metrics: Map<string, ScraperHealthMetrics> = new Map();
  private readonly testQuery = 'test'; // Simple query for health checks

  /**
   * Initialize metrics for a scraper
   */
  initializeScraper(source: string): void {
    if (!this.metrics.has(source)) {
      this.metrics.set(source, {
        source,
        status: 'healthy',
        lastCheck: new Date(),
        successCount: 0,
        failureCount: 0,
        successRate: 100,
        averageResponseTime: 0,
      });
    }
  }

  /**
   * Record scraper execution result
   */
  recordExecution(
    source: string,
    success: boolean,
    responseTime: number,
    error?: string
  ): void {
    const metrics = this.metrics.get(source);
    if (!metrics) {
      this.initializeScraper(source);
      return this.recordExecution(source, success, responseTime, error);
    }

    metrics.lastCheck = new Date();

    if (success) {
      metrics.successCount++;
      metrics.lastSuccess = new Date();
      metrics.lastError = undefined;
    } else {
      metrics.failureCount++;
      metrics.lastError = error;
    }

    // Calculate success rate
    const total = metrics.successCount + metrics.failureCount;
    metrics.successRate = (metrics.successCount / total) * 100;

    // Update average response time (exponential moving average)
    if (metrics.averageResponseTime === 0) {
      metrics.averageResponseTime = responseTime;
    } else {
      metrics.averageResponseTime =
        (metrics.averageResponseTime * 0.7) + (responseTime * 0.3);
    }

    // Update status based on success rate
    if (metrics.successRate >= 90) {
      metrics.status = 'healthy';
    } else if (metrics.successRate >= 50) {
      metrics.status = 'degraded';
    } else {
      metrics.status = 'down';
    }
  }

  /**
   * Get metrics for specific scraper
   */
  getMetrics(source: string): ScraperHealthMetrics | undefined {
    return this.metrics.get(source);
  }

  /**
   * Get metrics for all scrapers
   */
  getAllMetrics(): ScraperHealthMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'down';
    healthyCount: number;
    degradedCount: number;
    downCount: number;
    totalScrapers: number;
  } {
    const metrics = this.getAllMetrics();

    const healthyCount = metrics.filter(m => m.status === 'healthy').length;
    const degradedCount = metrics.filter(m => m.status === 'degraded').length;
    const downCount = metrics.filter(m => m.status === 'down').length;

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (downCount > metrics.length / 2) {
      status = 'down';
    } else if (degradedCount > 0 || downCount > 0) {
      status = 'degraded';
    }

    return {
      status,
      healthyCount,
      degradedCount,
      downCount,
      totalScrapers: metrics.length,
    };
  }

  /**
   * Get scrapers by status
   */
  getScrapersByStatus(status: 'healthy' | 'degraded' | 'down'): string[] {
    return Array.from(this.metrics.values())
      .filter(m => m.status === status)
      .map(m => m.source);
  }

  /**
   * Reset metrics for a scraper
   */
  resetMetrics(source: string): void {
    this.metrics.delete(source);
    this.initializeScraper(source);
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get health summary for logging
   */
  getHealthSummary(): string {
    const overall = this.getOverallHealth();
    const metrics = this.getAllMetrics();

    const lines = [
      '╔════════════════════════════════════════╗',
      '║     SCRAPER HEALTH SUMMARY             ║',
      '╠════════════════════════════════════════╣',
      `║ Overall Status: ${overall.status.toUpperCase().padEnd(23)}║`,
      `║ Healthy: ${overall.healthyCount.toString().padEnd(30)}║`,
      `║ Degraded: ${overall.degradedCount.toString().padEnd(29)}║`,
      `║ Down: ${overall.downCount.toString().padEnd(33)}║`,
      '╠════════════════════════════════════════╣',
    ];

    for (const metric of metrics) {
      const statusIcon =
        metric.status === 'healthy' ? '✓' :
        metric.status === 'degraded' ? '⚠' : '✗';

      lines.push(
        `║ ${statusIcon} ${metric.source.padEnd(15)} ${metric.successRate.toFixed(1)}% ${metric.averageResponseTime.toFixed(0)}ms ║`
      );
    }

    lines.push('╚════════════════════════════════════════╝');

    return lines.join('\n');
  }
}

// Export singleton instance
export const healthMonitor = new ScraperHealthMonitor();
