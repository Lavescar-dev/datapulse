import type { AdminCredentials } from '../../shared/types/session';

/**
 * Admin authentication service
 * Uses simple credential-based authentication from environment variables
 */
export class AdminAuth {
  private readonly adminUsername: string;
  private readonly adminPassword: string;

  constructor() {
    // Load admin credentials from environment
    this.adminUsername = process.env.ADMIN_USERNAME || 'admin';
    this.adminPassword = process.env.ADMIN_PASSWORD || 'change_me_in_production';

    if (this.adminPassword === 'change_me_in_production' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Using default admin password in production! Set ADMIN_PASSWORD in .env');
    }
  }

  /**
   * Verify admin credentials
   */
  verify(credentials: AdminCredentials): boolean {
    return (
      credentials.username === this.adminUsername &&
      credentials.password === this.adminPassword
    );
  }

  /**
   * Check if credentials are provided (for middleware)
   */
  hasCredentials(): boolean {
    return !!(this.adminUsername && this.adminPassword);
  }

  /**
   * Get admin username (for logging/display)
   */
  getUsername(): string {
    return this.adminUsername;
  }
}

// Export singleton instance
export const adminAuth = new AdminAuth();
