// Session and authentication types

export interface SessionState {
  isAdmin: boolean;
  requestsRemaining: number;
  expiresAt: number;
  createdAt: number;
  ip?: string;
  scrapesRemaining?: number;
  seoAnalysesRemaining?: number;
}

export interface JWTPayload extends SessionState {
  iat: number;
  exp: number;
}

export interface SessionStatus {
  active: boolean;
  requestsRemaining: number;
  timeRemaining: number; // in seconds
  expiresAt: number;
  scrapesRemaining?: number;
  seoAnalysesRemaining?: number;
}

export interface AdminCredentials {
  username: string;
  password: string;
}
