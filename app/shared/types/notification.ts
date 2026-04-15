// Notification types for DataPulse application

export type NotificationSource = 'price' | 'monitor' | 'social' | 'news' | 'system';
export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface NotificationMetadata {
  // Price alert metadata
  productId?: string;
  productName?: string;
  previousPrice?: number;
  currentPrice?: number;
  priceChange?: number;
  currency?: string;
  marketplace?: string;

  // Monitor alert metadata
  endpointId?: string;
  endpointName?: string;
  endpointUrl?: string;
  statusCode?: number;
  responseTime?: number;

  // Social/News mention metadata
  mentionId?: string;
  platform?: string;
  keyword?: string;
  postUrl?: string;
  author?: string;
}

export interface Notification {
  id: string;
  source: NotificationSource;
  severity: NotificationSeverity;
  status: NotificationStatus;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  actionUrl?: string;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
}

export interface NotificationFilter {
  source?: NotificationSource;
  severity?: NotificationSeverity;
  status?: NotificationStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
  bySource: {
    price: number;
    monitor: number;
    social: number;
    news: number;
    system: number;
  };
  bySeverity: {
    info: number;
    warning: number;
    error: number;
    success: number;
  };
}

export interface NotificationCache {
  notifications: Notification[];
  lastUpdated: number;
}

// Telegram webhook configuration (optional)
export interface TelegramConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
  notifyOn: NotificationSeverity[];
}
