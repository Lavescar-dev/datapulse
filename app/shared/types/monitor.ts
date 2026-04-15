// API health monitoring types

export interface HealthCheckResult {
  timestamp: string;
  statusCode: number | null;
  responseTime: number | null; // in milliseconds
  isUp: boolean;
  error?: string;
}

export interface SSLInfo {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysRemaining?: number;
}

export interface UptimeStats {
  period: '24h' | '7d' | '30d';
  uptimePercent: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
}

export interface MonitoredEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  enabled: boolean;
  checkInterval: number; // in minutes
  lastCheck?: string;
  currentStatus: 'up' | 'down' | 'unknown';
  lastResponseTime?: number;
  history: HealthCheckResult[];
  ssl?: SSLInfo;
  uptimeStats: {
    '24h': UptimeStats;
    '7d': UptimeStats;
    '30d': UptimeStats;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MonitorCache {
  endpoints: MonitoredEndpoint[];
  lastUpdated: number;
}
