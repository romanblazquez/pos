import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard.js';
import { signToken } from './jwt.js';

function contextFor(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard ownership', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters';
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;
  });

  it('blocks a customer token from another customer resource', () => {
    const reflector = {
      getAllAndOverride: (key: string) => key === 'roles' ? ['customer'] : false,
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector);
    const token = signToken({
      sub: 'principal-1', sid: 'session-1', role: 'customer', email: 'a@example.com',
      audience: 'marketplace-api', customerId: 'customer-a',
    });
    const request = {
      headers: { authorization: `Bearer ${token}` },
      params: { customerId: 'customer-b' },
      originalUrl: '/api/v1/customers/customer-b/wallet',
    };
    expect(() => guard.canActivate(contextFor(request))).toThrow(ForbiddenException);
  });

  it('allows the matching customer resource', () => {
    const reflector = {
      getAllAndOverride: (key: string) => key === 'roles' ? ['customer'] : false,
    } as unknown as Reflector;
    const guard = new AuthGuard(reflector);
    const token = signToken({
      sub: 'principal-1', sid: 'session-1', role: 'customer', email: 'a@example.com',
      audience: 'marketplace-api', customerId: 'customer-a',
    });
    const request = {
      headers: { authorization: `Bearer ${token}` },
      params: { customerId: 'customer-a' },
      originalUrl: '/api/v1/customers/customer-a/wallet',
    };
    expect(guard.canActivate(contextFor(request))).toBe(true);
  });
});
