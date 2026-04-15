import { notificationManager } from '../../cache/notifications';
import type { Notification, NotificationSource, NotificationSeverity, NotificationMetadata } from '../../../shared/types/notification';

/**
 * Notification Store Service
 * Collects alerts from all modules (price, monitor, social, news)
 * and routes them through the notification system
 */
export class NotificationStore {
  private initialized = false;

  /**
   * Initialize notification store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await notificationManager.initialize();
    this.initialized = true;
    console.log('✓ Notification store initialized');
  }

  /**
   * Create a price alert notification
   * Called when a price alert is triggered
   */
  async createPriceAlert(
    productId: string,
    productName: string,
    previousPrice: number,
    currentPrice: number,
    currency: string,
    marketplace: string,
    condition: 'above' | 'below',
    targetPrice: number
  ): Promise<Notification> {
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = ((priceChange / previousPrice) * 100).toFixed(1);

    const isDown = priceChange < 0;
    const conditionLabel = condition === 'below' ? 'altına düştü' : 'üstüne çıktı';

    return await notificationManager.addNotification({
      source: 'price',
      severity: isDown ? 'success' : 'warning',
      title: `Fiyat Alarmı: ${productName.substring(0, 50)}${productName.length > 50 ? '...' : ''}`,
      message: `${productName} fiyatı hedef fiyat ${targetPrice} ${currency} ${conditionLabel}. Yeni fiyat: ${currentPrice} ${currency} (${isDown ? '' : '+'}${priceChangePercent}%)`,
      metadata: {
        productId,
        productName,
        previousPrice,
        currentPrice,
        priceChange,
        currency,
        marketplace,
      },
      actionUrl: '/price-tracker',
    });
  }

  /**
   * Create a price drop notification
   * Called when a product price drops significantly
   */
  async createPriceDropAlert(
    productId: string,
    productName: string,
    previousPrice: number,
    currentPrice: number,
    currency: string,
    marketplace: string,
    dropPercent: number
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'price',
      severity: 'success',
      title: `Fiyat Düşüşü: ${productName.substring(0, 50)}${productName.length > 50 ? '...' : ''}`,
      message: `${productName} fiyatı %${Math.abs(dropPercent).toFixed(1)} düştü! Önceki: ${previousPrice} ${currency}, Şimdi: ${currentPrice} ${currency}`,
      metadata: {
        productId,
        productName,
        previousPrice,
        currentPrice,
        priceChange: currentPrice - previousPrice,
        currency,
        marketplace,
      },
      actionUrl: '/price-tracker',
    });
  }

  /**
   * Create an API down notification
   * Called when an endpoint goes down
   */
  async createApiDownAlert(
    endpointId: string,
    endpointName: string,
    endpointUrl: string,
    statusCode: number,
    errorMessage?: string
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'monitor',
      severity: 'error',
      title: `API Çöktü: ${endpointName}`,
      message: errorMessage
        ? `${endpointName} yanıt vermiyor. Hata: ${errorMessage}`
        : `${endpointName} yanıt vermiyor. Status: ${statusCode}`,
      metadata: {
        endpointId,
        endpointName,
        endpointUrl,
        statusCode,
      },
      actionUrl: '/api-monitor',
    });
  }

  /**
   * Create an API recovery notification
   * Called when an endpoint comes back up
   */
  async createApiRecoveryAlert(
    endpointId: string,
    endpointName: string,
    endpointUrl: string,
    responseTime: number
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'monitor',
      severity: 'success',
      title: `API Düzeldi: ${endpointName}`,
      message: `${endpointName} tekrar yanıt veriyor. Yanıt süresi: ${responseTime}ms`,
      metadata: {
        endpointId,
        endpointName,
        endpointUrl,
        responseTime,
      },
      actionUrl: '/api-monitor',
    });
  }

  /**
   * Create a slow API notification
   * Called when response time exceeds threshold
   */
  async createSlowApiAlert(
    endpointId: string,
    endpointName: string,
    endpointUrl: string,
    responseTime: number,
    threshold: number
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'monitor',
      severity: 'warning',
      title: `Yavaş API: ${endpointName}`,
      message: `${endpointName} yanıt süresi yüksek: ${responseTime}ms (eşik: ${threshold}ms)`,
      metadata: {
        endpointId,
        endpointName,
        endpointUrl,
        responseTime,
      },
      actionUrl: '/api-monitor',
    });
  }

  /**
   * Create an SSL expiry warning notification
   * Called when SSL certificate is expiring soon
   */
  async createSslExpiryAlert(
    endpointId: string,
    endpointName: string,
    endpointUrl: string,
    daysRemaining: number
  ): Promise<Notification> {
    const severity: NotificationSeverity = daysRemaining <= 7 ? 'error' : 'warning';

    return await notificationManager.addNotification({
      source: 'monitor',
      severity,
      title: `SSL Sertifikası Sona Eriyor: ${endpointName}`,
      message: `${endpointName} SSL sertifikası ${daysRemaining} gün içinde sona erecek. Yenileme gerekli!`,
      metadata: {
        endpointId,
        endpointName,
        endpointUrl,
      },
      actionUrl: '/api-monitor',
    });
  }

  /**
   * Create a keyword mention notification
   * Called when a keyword is mentioned in news
   */
  async createNewsMentionAlert(
    keyword: string,
    articleTitle: string,
    source: string,
    articleUrl: string
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'news',
      severity: 'info',
      title: `Haber Eşleşmesi: "${keyword}"`,
      message: `"${keyword}" anahtar kelimesi yeni haberde geçiyor: ${articleTitle} (${source})`,
      metadata: {
        keyword,
        platform: source,
        postUrl: articleUrl,
      },
      actionUrl: '/news',
    });
  }

  /**
   * Create a social media mention notification
   * Called when a keyword is mentioned in social media
   */
  async createSocialMentionAlert(
    keyword: string,
    platform: string,
    postTitle: string,
    postUrl: string,
    author?: string
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'social',
      severity: 'info',
      title: `Sosyal Medya Eşleşmesi: "${keyword}"`,
      message: `"${keyword}" anahtar kelimesi ${platform} üzerinde paylaşıldı: ${postTitle.substring(0, 100)}${postTitle.length > 100 ? '...' : ''}`,
      metadata: {
        keyword,
        platform,
        postUrl,
        author,
      },
      actionUrl: '/social',
    });
  }

  /**
   * Create a trending topic notification
   * Called when a topic starts trending
   */
  async createTrendingAlert(
    platform: string,
    topic: string,
    score: number,
    postUrl?: string
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'social',
      severity: 'info',
      title: `Trend: ${topic.substring(0, 50)}${topic.length > 50 ? '...' : ''}`,
      message: `${platform} üzerinde trend olan içerik: ${topic} (Skor: ${score})`,
      metadata: {
        platform,
        keyword: topic,
        postUrl,
      },
      actionUrl: '/social',
    });
  }

  /**
   * Create a system notification
   * For general system alerts (maintenance, updates, etc.)
   */
  async createSystemAlert(
    title: string,
    message: string,
    severity: NotificationSeverity = 'info',
    actionUrl?: string
  ): Promise<Notification> {
    return await notificationManager.addNotification({
      source: 'system',
      severity,
      title,
      message,
      actionUrl,
    });
  }

  /**
   * Seed demo notifications for testing
   */
  async seedDemoNotifications(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if we already have notifications
    const existingCount = await notificationManager.getUnreadCount();
    if (existingCount > 0) {
      console.log(`✓ Skipping notification seed - ${existingCount} notifications already exist`);
      return;
    }

    console.log('🌱 Seeding demo notifications...');

    // Price alerts
    await this.createPriceAlert(
      'product-demo1',
      'Apple iPhone 15 Pro Max 256GB',
      65999,
      61999,
      'TL',
      'Trendyol',
      'below',
      62000
    );

    await this.createPriceDropAlert(
      'product-demo2',
      'Samsung Galaxy S24 Ultra 512GB',
      74999,
      69999,
      'TL',
      'Hepsiburada',
      6.7
    );

    // API alerts
    await this.createApiDownAlert(
      'endpoint-demo1',
      'CoinGecko API',
      'https://api.coingecko.com/api/v3/ping',
      503,
      'Service Unavailable'
    );

    await this.createSlowApiAlert(
      'endpoint-demo2',
      'News API',
      'https://newsapi.org/v2/top-headlines',
      2500,
      1000
    );

    // Social mention
    await this.createSocialMentionAlert(
      'Bitcoin',
      'Reddit',
      'Bitcoin breaks $100k resistance level for the first time in history!',
      'https://reddit.com/r/cryptocurrency/comments/abc123',
      'crypto_enthusiast'
    );

    // News mention
    await this.createNewsMentionAlert(
      'AI',
      'OpenAI announces GPT-5 with revolutionary capabilities',
      'TechCrunch',
      'https://techcrunch.com/2025/01/15/openai-gpt5'
    );

    // System alert
    await this.createSystemAlert(
      'DataPulse Demo Aktif',
      'Demo oturumunuz başlatıldı. Tüm modülleri keşfedebilirsiniz!',
      'info'
    );

    console.log('✓ Demo notifications seeded');
  }
}

export const notificationStore = new NotificationStore();
