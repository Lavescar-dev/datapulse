import type { Context, Next } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { sessionManager } from '../auth/session';
import type { SessionState } from '../../shared/types/session';

/**
 * Extended context with session information
 */
export interface AuthContext extends Context {
  get: (key: 'session') => SessionState | undefined;
  set: (key: 'session', value: SessionState) => void;
}

type AuthErrorCode =
  | 'SESSION_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'REQUEST_LIMIT_EXCEEDED'
  | 'ADMIN_REQUIRED';

export function getCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: (process.env.COOKIE_SAME_SITE || 'Lax') as 'Lax' | 'Strict' | 'None',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: Math.floor(sessionManager.getSessionDuration() / 1000),
  };
}

export function writeSessionCookie(c: Context, token: string, maxAge?: number) {
  const options = getCookieOptions();
  setCookie(c, sessionManager.getCookieName(), token, {
    ...options,
    maxAge: maxAge ?? options.maxAge,
  });
}

function authError(c: Context, code: AuthErrorCode, message: string, status: number) {
  return c.json({
    success: false,
    code,
    message,
    error: message,
  }, status);
}

/**
 * Authentication middleware
 * Verifies session tokens and attaches session state to context
 */
export async function authMiddleware(c: Context, next: Next) {
  const token = getCookie(c, sessionManager.getCookieName());

  if (!token) {
    return authError(c, 'SESSION_REQUIRED', 'No session token provided', 401);
  }

  const session = await sessionManager.verifySession(token);

  if (!session) {
    return authError(c, 'SESSION_EXPIRED', 'Invalid or expired session', 401);
  }

  // Check if session has expired
  if (session.expiresAt < Date.now()) {
    return authError(c, 'SESSION_EXPIRED', 'Session expired', 401);
  }

  // Check if demo session has no requests remaining
  if (!session.isAdmin && session.requestsRemaining <= 0) {
    return authError(c, 'REQUEST_LIMIT_EXCEEDED', 'Request limit exceeded', 429);
  }

  // Attach session to context
  c.set('session', session);

  await next();
}

/**
 * Admin-only middleware
 * Ensures only admin sessions can access the route
 */
export async function adminOnlyMiddleware(c: Context, next: Next) {
  const session = c.get('session') as SessionState | undefined;

  if (!session || !session.isAdmin) {
    return authError(c, 'ADMIN_REQUIRED', 'Admin access required', 403);
  }

  await next();
}

/**
 * Optional authentication middleware
 * Attaches session if available but doesn't require it
 */
export async function optionalAuthMiddleware(c: Context, next: Next) {
  const token = getCookie(c, sessionManager.getCookieName());

  if (token) {
    const session = await sessionManager.verifySession(token);
    if (session && session.expiresAt > Date.now()) {
      c.set('session', session);
    }
  }

  await next();
}

/**
 * Request counting middleware
 * Decrements request count for demo sessions
 */
export async function requestCountMiddleware(c: Context, next: Next) {
  const token = getCookie(c, sessionManager.getCookieName());

  if (!token) {
    await next();
    return;
  }

  const session = c.get('session') as SessionState | undefined;

  // Only decrement for demo sessions
  if (session && !session.isAdmin && session.requestsRemaining > 0) {
    const newToken = await sessionManager.decrementRequests(token);

    if (newToken) {
      writeSessionCookie(c, newToken);
    }
  }

  await next();
}

export function getSessionFromContext(c: Context): SessionState {
  return c.get('session') as SessionState;
}
