import { existsSync } from 'fs';
import { join } from 'path';
import type {
  NotificationCache,
  Notification,
  NotificationFilter,
  NotificationStats,
  NotificationSource,
  NotificationSeverity,
  NotificationStatus,
} from '../../shared/types/notification';

const CACHE_FILE_PATH = join(__dirname, 'notifications.json');
const MAX_NOTIFICATIONS = 500; // Keep last 500 notifications

export class NotificationManager {
  private cache: NotificationCache | null = null;
  private initialized = false;

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromFile();
      this.initialized = true;
      console.log('✓ Notification cache initialized');
    } catch (error) {
      console.error('Error initializing notification cache:', error);
      this.cache = { notifications: [], lastUpdated: Date.now() };
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
        console.log(`✓ Loaded ${this.cache?.notifications.length || 0} notifications from cache`);
      } else {
        this.cache = { notifications: [], lastUpdated: Date.now() };
      }
    } catch (error) {
      console.error('Error loading notifications from file:', error);
      this.cache = { notifications: [], lastUpdated: Date.now() };
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(): Promise<void> {
    try {
      await Bun.write(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
      console.log('✓ Saved notifications to file');
    } catch (error) {
      console.error('Error saving notifications to file:', error);
    }
  }

  /**
   * Get all notifications with optional filtering
   */
  async getAllNotifications(filter?: NotificationFilter): Promise<Notification[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    let notifications = this.cache?.notifications || [];

    // Apply filters
    if (filter) {
      if (filter.source) {
        notifications = notifications.filter(n => n.source === filter.source);
      }
      if (filter.severity) {
        notifications = notifications.filter(n => n.severity === filter.severity);
      }
      if (filter.status) {
        notifications = notifications.filter(n => n.status === filter.status);
      }
      if (filter.startDate) {
        notifications = notifications.filter(n => new Date(n.createdAt) >= new Date(filter.startDate!));
      }
      if (filter.endDate) {
        notifications = notifications.filter(n => new Date(n.createdAt) <= new Date(filter.endDate!));
      }

      // Apply pagination
      if (filter.offset) {
        notifications = notifications.slice(filter.offset);
      }
      if (filter.limit) {
        notifications = notifications.slice(0, filter.limit);
      }
    }

    // Sort by createdAt descending (most recent first)
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get notification by ID
   */
  async getNotification(id: string): Promise<Notification | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.notifications.find(n => n.id === id) || null;
  }

  /**
   * Get unread notifications
   */
  async getUnreadNotifications(): Promise<Notification[]> {
    return this.getAllNotifications({ status: 'unread' });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.notifications.filter(n => n.status === 'unread').length || 0;
  }

  /**
   * Add new notification
   */
  async addNotification(
    notification: Omit<Notification, 'id' | 'createdAt' | 'status'> & { status?: NotificationStatus }
  ): Promise<Notification> {
    if (!this.initialized) {
      await this.initialize();
    }

    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newNotification: Notification = {
      ...notification,
      id,
      status: notification.status || 'unread',
      createdAt: new Date().toISOString(),
    };

    this.cache!.notifications.push(newNotification);
    this.cache!.lastUpdated = Date.now();

    // Trim old notifications if we exceed max limit
    if (this.cache!.notifications.length > MAX_NOTIFICATIONS) {
      // Keep only unread and recent notifications
      const unread = this.cache!.notifications.filter(n => n.status === 'unread');
      const others = this.cache!.notifications
        .filter(n => n.status !== 'unread')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_NOTIFICATIONS - unread.length);

      this.cache!.notifications = [...unread, ...others];
    }

    await this.saveToFile();

    console.log(`🔔 New notification: ${newNotification.title} [${newNotification.severity}]`);
    return newNotification;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string): Promise<Notification | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const notification = this.cache?.notifications.find(n => n.id === id);
    if (!notification) {
      return null;
    }

    notification.status = 'read';
    notification.readAt = new Date().toISOString();
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    let count = 0;
    const now = new Date().toISOString();

    for (const notification of this.cache!.notifications) {
      if (notification.status === 'unread') {
        notification.status = 'read';
        notification.readAt = now;
        count++;
      }
    }

    if (count > 0) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Marked ${count} notifications as read`);
    }

    return count;
  }

  /**
   * Archive notification
   */
  async archiveNotification(id: string): Promise<Notification | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const notification = this.cache?.notifications.find(n => n.id === id);
    if (!notification) {
      return null;
    }

    notification.status = 'archived';
    notification.archivedAt = new Date().toISOString();
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    return notification;
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.cache!.notifications.length;
    this.cache!.notifications = this.cache!.notifications.filter(n => n.id !== id);

    if (this.cache!.notifications.length < initialLength) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Deleted notification: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Clear all archived notifications
   */
  async clearArchived(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.cache!.notifications.length;
    this.cache!.notifications = this.cache!.notifications.filter(n => n.status !== 'archived');
    const removed = initialLength - this.cache!.notifications.length;

    if (removed > 0) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Cleared ${removed} archived notifications`);
    }

    return removed;
  }

  /**
   * Get notification statistics
   */
  async getStats(): Promise<NotificationStats> {
    if (!this.initialized) {
      await this.initialize();
    }

    const all = this.cache?.notifications || [];

    return {
      total: all.length,
      unread: all.filter(n => n.status === 'unread').length,
      read: all.filter(n => n.status === 'read').length,
      archived: all.filter(n => n.status === 'archived').length,
      bySource: {
        price: all.filter(n => n.source === 'price').length,
        monitor: all.filter(n => n.source === 'monitor').length,
        social: all.filter(n => n.source === 'social').length,
        news: all.filter(n => n.source === 'news').length,
        system: all.filter(n => n.source === 'system').length,
      },
      bySeverity: {
        info: all.filter(n => n.severity === 'info').length,
        warning: all.filter(n => n.severity === 'warning').length,
        error: all.filter(n => n.severity === 'error').length,
        success: all.filter(n => n.severity === 'success').length,
      },
    };
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<{
    notificationCount: number;
    unreadCount: number;
    lastUpdated: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    return {
      notificationCount: this.cache?.notifications.length || 0,
      unreadCount: this.cache?.notifications.filter(n => n.status === 'unread').length || 0,
      lastUpdated: this.cache?.lastUpdated || 0,
    };
  }

  /**
   * Archive old notifications (older than specified days)
   */
  async archiveOldNotifications(daysOld: number = 30): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let archivedCount = 0;
    const now = new Date().toISOString();

    for (const notification of this.cache!.notifications) {
      if (
        notification.status !== 'archived' &&
        new Date(notification.createdAt) < cutoffDate
      ) {
        notification.status = 'archived';
        notification.archivedAt = now;
        archivedCount++;
      }
    }

    if (archivedCount > 0) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Archived ${archivedCount} old notifications`);
    }

    return archivedCount;
  }
}

export const notificationManager = new NotificationManager();
