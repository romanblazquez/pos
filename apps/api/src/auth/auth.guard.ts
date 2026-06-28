import {
  CanActivate, ExecutionContext, Injectable,
  ForbiddenException, UnauthorizedException, SetMetadata, Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, type TokenRole } from './jwt.js';
import type { Request } from 'express';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TokenRole[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata('isPublic', true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const payload = verifyToken(token);
      // Attach to request so controllers can read it
      (req as Request & { user: typeof payload }).user = payload;

      const requiredRoles = this.reflector.getAllAndOverride<TokenRole[]>(ROLES_KEY, [
        ctx.getHandler(), ctx.getClass(),
      ]);
      if (requiredRoles && !requiredRoles.includes(payload.role)) {
        throw new ForbiddenException('Insufficient role');
      }

      this.assertAudience(payload);
      this.assertResourceOwnership(req, payload);

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }

  private assertAudience(payload: ReturnType<typeof verifyToken>): void {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const expected = {
      customer: 'marketplace-api',
      admin: 'admin-api',
      seller: 'seller-api',
      service: 'internal-api',
    }[payload.role];
    if (!audiences.includes(expected)) throw new UnauthorizedException('Token audience mismatch');
  }

  private assertResourceOwnership(req: Request, payload: ReturnType<typeof verifyToken>): void {
    if (payload.role === 'admin' || payload.role === 'service') return;
    const params = req.params as Record<string, string | undefined>;
    if (payload.role === 'customer' && params.customerId && params.customerId !== payload.customerId) {
      throw new ForbiddenException('Customer resource access denied');
    }
    if (payload.role === 'seller') {
      const sellerParam = params.sellerId
        ?? (req.originalUrl.startsWith('/api/v1/sellers/') ? params.id : undefined);
      if (sellerParam && sellerParam !== payload.sellerId) {
        throw new ForbiddenException('Seller resource access denied');
      }
    }
  }
}
