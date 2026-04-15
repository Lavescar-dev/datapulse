use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};

use crate::{
    config::Config,
    models::{SessionClaims, SessionStatus},
};

#[derive(Clone)]
pub struct SessionManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
    session_duration_minutes: i64,
}

impl SessionManager {
    pub fn new(config: &Config) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(config.jwt_secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(config.jwt_secret.as_bytes()),
            session_duration_minutes: config.demo_session_duration_minutes,
        }
    }

    pub fn create_demo_session(&self, ip: Option<String>) -> Result<String, jsonwebtoken::errors::Error> {
        let now = Utc::now();
        let expires_at = now + Duration::minutes(self.session_duration_minutes);

        let claims = SessionClaims {
            is_admin: false,
            requests_remaining: 100,
            expires_at: expires_at.timestamp_millis(),
            created_at: now.timestamp_millis(),
            ip,
            scrapes_remaining: Some(3),
            seo_analyses_remaining: Some(3),
            exp: expires_at.timestamp() as usize,
        };

        encode(&Header::default(), &claims, &self.encoding_key)
    }

    pub fn create_admin_session(&self, ip: Option<String>) -> Result<String, jsonwebtoken::errors::Error> {
        let now = Utc::now();
        let expires_at = now + Duration::hours(24);

        let claims = SessionClaims {
            is_admin: true,
            requests_remaining: -1,
            expires_at: expires_at.timestamp_millis(),
            created_at: now.timestamp_millis(),
            ip,
            scrapes_remaining: None,
            seo_analyses_remaining: None,
            exp: expires_at.timestamp() as usize,
        };

        encode(&Header::default(), &claims, &self.encoding_key)
    }

    pub fn verify(&self, token: &str) -> Option<SessionClaims> {
        let decoded = decode::<SessionClaims>(token, &self.decoding_key, &Validation::default()).ok()?;
        let claims = decoded.claims;

        if Utc::now().timestamp_millis() > claims.expires_at {
            return None;
        }

        Some(claims)
    }

    pub fn status(&self, claims: &SessionClaims) -> SessionStatus {
        let now = Utc::now().timestamp_millis();
        SessionStatus {
            active: claims.expires_at > now,
            is_admin: claims.is_admin,
            requests_remaining: claims.requests_remaining,
            time_remaining: ((claims.expires_at - now).max(0)) / 1000,
            expires_at: claims.expires_at,
            scrapes_remaining: claims.scrapes_remaining.unwrap_or(3),
            seo_analyses_remaining: claims.seo_analyses_remaining.unwrap_or(3),
        }
    }
}
