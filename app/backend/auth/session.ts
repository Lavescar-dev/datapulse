import { SignJWT, jwtVerify } from 'jose';
import type { SessionState, JWTPayload, SessionStatus } from '../../shared/types/session';

/**
 * Session management service
 * Handles JWT-based demo sessions with 30-minute expiry
 * Stateless implementation using cookies
 */
export class SessionManager {
  private readonly secret: Uint8Array;
  private readonly sessionDuration = 30 * 60 * 1000; // 30 minutes in ms
  private readonly cookieName = 'datapulse_session';

  constructor() {
    // Load or generate JWT secret
    const secretKey = process.env.JWT_SECRET || 'default_secret_change_in_production';

    if (secretKey === 'default_secret_change_in_production' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  WARNING: Using default JWT secret in production! Set JWT_SECRET in .env');
    }

    this.secret = new TextEncoder().encode(secretKey);
  }

  /**
   * Create a new demo session
   */
  async createDemoSession(ip?: string): Promise<string> {
    const now = Date.now();
    const expiresAt = now + this.sessionDuration;

    const payload: SessionState = {
      isAdmin: false,
      requestsRemaining: 100, // Default request limit for demo sessions
      expiresAt,
      createdAt: now,
      ip,
      scrapesRemaining: 3, // 3 scrapes per session
      seoAnalysesRemaining: 3, // 3 SEO analyses per session
    };

    const token = await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .sign(this.secret);

    return token;
  }

  /**
   * Create an admin session
   */
  async createAdminSession(ip?: string): Promise<string> {
    const now = Date.now();
    const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours for admin

    const payload: SessionState = {
      isAdmin: true,
      requestsRemaining: -1, // Unlimited for admin
      expiresAt,
      createdAt: now,
      ip,
    };

    const token = await new SignJWT(payload as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .sign(this.secret);

    return token;
  }

  /**
   * Verify and decode a session token
   */
  async verifySession(token: string): Promise<SessionState | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret);

      // Check if session is expired
      const now = Date.now();
      const expiresAt = (payload as any).expiresAt || 0;

      if (now > expiresAt) {
        return null;
      }

      return payload as unknown as SessionState;
    } catch (error) {
      // Invalid or expired token
      return null;
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(token: string): Promise<SessionStatus | null> {
    const session = await this.verifySession(token);

    if (!session) {
      return null;
    }

    const now = Date.now();
    const timeRemaining = Math.max(0, Math.floor((session.expiresAt - now) / 1000));

    return {
      active: timeRemaining > 0,
      requestsRemaining: session.requestsRemaining,
      timeRemaining,
      expiresAt: session.expiresAt,
      scrapesRemaining: session.scrapesRemaining ?? 3,
      seoAnalysesRemaining: session.seoAnalysesRemaining ?? 3,
    };
  }

  /**
   * Decrement request count for a session
   */
  async decrementRequests(token: string): Promise<string | null> {
    const session = await this.verifySession(token);

    if (!session) {
      return null;
    }

    // Admin sessions have unlimited requests
    if (session.isAdmin || session.requestsRemaining < 0) {
      return token;
    }

    // Decrement request count
    session.requestsRemaining = Math.max(0, session.requestsRemaining - 1);

    // Create new token with updated count
    const newToken = await new SignJWT(session as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(session.expiresAt / 1000))
      .sign(this.secret);

    return newToken;
  }

  /**
   * Decrement scrapes count for a session
   */
  async decrementScrapes(token: string): Promise<string | null> {
    const session = await this.verifySession(token);

    if (!session) {
      return null;
    }

    // Admin sessions have unlimited scrapes
    if (session.isAdmin) {
      return token;
    }

    // Decrement scrapes count
    session.scrapesRemaining = Math.max(0, (session.scrapesRemaining || 3) - 1);

    // Create new token with updated count
    const newToken = await new SignJWT(session as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(session.expiresAt / 1000))
      .sign(this.secret);

    return newToken;
  }

  /**
   * Decrement SEO analyses count for a session
   */
  async decrementSEOAnalyses(token: string): Promise<string | null> {
    const session = await this.verifySession(token);

    if (!session) {
      return null;
    }

    // Admin sessions have unlimited analyses
    if (session.isAdmin) {
      return token;
    }

    // Decrement SEO analyses count
    session.seoAnalysesRemaining = Math.max(0, (session.seoAnalysesRemaining || 3) - 1);

    // Create new token with updated count
    const newToken = await new SignJWT(session as any)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(session.expiresAt / 1000))
      .sign(this.secret);

    return newToken;
  }

  /**
   * Get cookie name for session storage
   */
  getCookieName(): string {
    return this.cookieName;
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(): number {
    return this.sessionDuration;
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
