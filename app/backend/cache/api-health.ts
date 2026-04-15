import { existsSync } from 'fs';
import { join } from 'path';
import type {
  MonitorCache,
  MonitoredEndpoint,
  HealthCheckResult,
  UptimeStats,
} from '../../shared/types/monitor';

const CACHE_FILE_PATH = join(__dirname, 'api-health.json');

export class ApiHealthManager {
  private cache: MonitorCache | null = null;
  private initialized = false;

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromFile();
      this.initialized = true;
      console.log('✓ API health cache initialized');
    } catch (error) {
      console.error('Error initializing API health cache:', error);
      this.cache = { endpoints: [], lastUpdated: Date.now() };
      this.initialized = true;
    }
  }

  /**
   * Load cache from JSON file
   */
  private async loadFromFile(): Promise<void> {
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        const file = Bun.file(CACHE_FILE_PATH);
        const data = await file.text();
        this.cache = JSON.parse(data);
        console.log(`✓ Loaded ${this.cache?.endpoints.length || 0} monitored endpoints from cache`);
      } else {
        this.cache = { endpoints: [], lastUpdated: Date.now() };
      }
    } catch (error) {
      console.error('Error loading API health from file:', error);
      this.cache = { endpoints: [], lastUpdated: Date.now() };
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(): Promise<void> {
    try {
      await Bun.write(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
      console.log('✓ Saved API health to file');
    } catch (error) {
      console.error('Error saving API health to file:', error);
    }
  }

  /**
   * Get all monitored endpoints
   */
  async getAllEndpoints(): Promise<MonitoredEndpoint[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.endpoints || [];
  }

  /**
   * Get endpoint by ID
   */
  async getEndpoint(id: string): Promise<MonitoredEndpoint | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.endpoints.find(e => e.id === id) || null;
  }

  /**
   * Add new endpoint to monitor
   */
  async addEndpoint(
    endpoint: Omit<MonitoredEndpoint, 'id' | 'history' | 'uptimeStats' | 'createdAt' | 'updatedAt' | 'currentStatus'>
  ): Promise<MonitoredEndpoint> {
    if (!this.initialized) {
      await this.initialize();
    }

    const id = this.generateEndpointId(endpoint.url);

    const emptyStats: UptimeStats = {
      period: '24h',
      uptimePercent: 0,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
    };

    const newEndpoint: MonitoredEndpoint = {
      ...endpoint,
      id,
      history: [],
      currentStatus: 'unknown',
      uptimeStats: {
        '24h': { ...emptyStats, period: '24h' },
        '7d': { ...emptyStats, period: '7d' },
        '30d': { ...emptyStats, period: '30d' },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cache!.endpoints.push(newEndpoint);
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Added endpoint to monitoring: ${newEndpoint.name}`);
    return newEndpoint;
  }

  /**
   * Update endpoint health check
   */
  async updateEndpointHealth(id: string, result: HealthCheckResult): Promise<MonitoredEndpoint | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const endpoint = this.cache?.endpoints.find(e => e.id === id);

    if (!endpoint) {
      return null;
    }

    // Add new check result to history
    endpoint.history.push(result);
    endpoint.lastCheck = result.timestamp;
    endpoint.currentStatus = result.isUp ? 'up' : 'down';
    endpoint.lastResponseTime = result.responseTime || undefined;
    endpoint.updatedAt = new Date().toISOString();

    // Keep only last 30 days of history (at 5-minute intervals, ~8640 checks)
    // We'll limit to 1000 most recent checks for performance
    if (endpoint.history.length > 1000) {
      endpoint.history = endpoint.history.slice(-1000);
    }

    // Recalculate uptime statistics
    this.calculateUptimeStats(endpoint);

    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Updated health for: ${endpoint.name} - ${result.isUp ? 'UP' : 'DOWN'}`);

    return endpoint;
  }

  /**
   * Remove endpoint from monitoring
   */
  async removeEndpoint(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.cache!.endpoints.length;
    this.cache!.endpoints = this.cache!.endpoints.filter(e => e.id !== id);

    if (this.cache!.endpoints.length < initialLength) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Removed endpoint from monitoring: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Update SSL info for an endpoint
   */
  async updateSSLInfo(id: string, sslInfo: any): Promise<void> {
    const endpoint = this.cache?.endpoints.find(e => e.id === id);

    if (endpoint) {
      endpoint.ssl = sslInfo;
      endpoint.updatedAt = new Date().toISOString();
      await this.saveToFile();
    }
  }

  /**
   * Calculate uptime statistics for an endpoint
   */
  private calculateUptimeStats(endpoint: MonitoredEndpoint): void {
    const now = new Date();

    // Define time periods
    const periods = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    // Calculate stats for each period
    for (const [period, milliseconds] of Object.entries(periods)) {
      const cutoffTime = new Date(now.getTime() - milliseconds);

      const relevantChecks = endpoint.history.filter(
        check => new Date(check.timestamp) > cutoffTime
      );

      const totalChecks = relevantChecks.length;
      const successfulChecks = relevantChecks.filter(c => c.isUp).length;
      const failedChecks = totalChecks - successfulChecks;

      const uptimePercent = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

      const responseTimes = relevantChecks
        .filter(c => c.responseTime !== null)
        .map(c => c.responseTime!);

      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
          : 0;

      endpoint.uptimeStats[period as '24h' | '7d' | '30d'] = {
        period: period as '24h' | '7d' | '30d',
        uptimePercent: Math.round(uptimePercent * 100) / 100,
        totalChecks,
        successfulChecks,
        failedChecks,
        averageResponseTime: Math.round(averageResponseTime),
      };
    }
  }

  /**
   * Generate unique endpoint ID from URL
   */
  private generateEndpointId(url: string): string {
    const hash = Bun.hash(url).toString(36);
    return `endpoint-${hash}`;
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<{
    endpointCount: number;
    lastUpdated: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    return {
      endpointCount: this.cache?.endpoints.length || 0,
      lastUpdated: this.cache?.lastUpdated || 0,
    };
  }

  /**
   * Get endpoints by status
   */
  async getEndpointsByStatus(status: 'up' | 'down' | 'unknown'): Promise<MonitoredEndpoint[]> {
    const allEndpoints = await this.getAllEndpoints();
    return allEndpoints.filter(e => e.currentStatus === status);
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    total: number;
    up: number;
    down: number;
    unknown: number;
    enabled: number;
    disabled: number;
  }> {
    const allEndpoints = await this.getAllEndpoints();

    return {
      total: allEndpoints.length,
      up: allEndpoints.filter(e => e.currentStatus === 'up').length,
      down: allEndpoints.filter(e => e.currentStatus === 'down').length,
      unknown: allEndpoints.filter(e => e.currentStatus === 'unknown').length,
      enabled: allEndpoints.filter(e => e.enabled).length,
      disabled: allEndpoints.filter(e => !e.enabled).length,
    };
  }
}

export const apiHealthManager = new ApiHealthManager();
