import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from './jwt.js';

describe('first-party JWT', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
  });

  it('issues a short-lived token with pinned issuer, audience, session and key id', () => {
    const token = signToken({
      sub: 'principal-1', sid: 'session-1', role: 'customer',
      email: 'buyer@example.com', audience: 'marketplace-api', customerId: 'customer-1',
    });
    const payload = verifyToken(token);
    const header = jwt.decode(token, { complete: true })?.header;

    expect(payload.sub).toBe('principal-1');
    expect(payload.sid).toBe('session-1');
    expect(payload.aud).toBe('marketplace-api');
    expect(payload.exp! - payload.iat!).toBe(600);
    expect(header?.alg).toBe('HS256');
    expect(header?.kid).toBe('development');
  });

  it('rejects a modified token', () => {
    const token = signToken({
      sub: 'principal-1', sid: 'session-1', role: 'admin',
      email: 'admin@example.com', audience: 'admin-api',
    });
    expect(() => verifyToken(`${token.slice(0, -1)}x`)).toThrow();
  });
});
