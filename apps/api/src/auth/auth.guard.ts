import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, SetMetadata, Inject,
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
        throw new UnauthorizedException('Insufficient role');
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return null;
  }
}
