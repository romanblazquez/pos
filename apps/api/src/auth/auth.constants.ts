import type { CookieOptions } from 'express';
import type { TokenAudience, TokenRole } from './jwt.js';

export type AuthApp = 'marketplace' | 'admin' | 'seller';

const cookieName = (name: string) => process.env.NODE_ENV === 'production' ? `__Host-${name}` : name;

export const APP_SECURITY: Record<AuthApp, {
  audience: TokenAudience;
  role: TokenRole;
  cookieName: string;
  accessTtlSeconds: number;
}> = {
  marketplace: {
    audience: 'marketplace-api', role: 'customer',
    cookieName: cookieName('retail_mkt_refresh'), accessTtlSeconds: 600,
  },
  admin: {
    audience: 'admin-api', role: 'admin',
    cookieName: cookieName('retail_admin_refresh'), accessTtlSeconds: 300,
  },
  seller: {
    audience: 'seller-api', role: 'seller',
    cookieName: cookieName('retail_seller_refresh'), accessTtlSeconds: 600,
  },
};

export function refreshCookieOptions(): CookieOptions {
  const secure = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: secure ? '/' : '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}
