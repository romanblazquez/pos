import {
  CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { catchError, from, mergeMap, Observable, throwError } from 'rxjs';
import { AuditService } from './audit.service.js';
import { clientIp } from '../common/client-ip.js';
import type { JwtPayload } from './jwt.js';

@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!request.user || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next.handle();

    const correlationId = request.get('x-correlation-id')?.slice(0, 128) ?? randomUUID();
    const event = {
      actorPrincipalId: request.user.sub,
      sessionId: request.user.sid,
      action: `api.${request.method.toLowerCase()}`,
      targetType: request.route?.path ? String(request.route.path) : request.path,
      targetId: Object.values(request.params)[0],
      correlationId,
      ipAddress: clientIp(request),
      metadata: { role: request.user.role },
    };

    return next.handle().pipe(
      mergeMap((value) => from(this.audit.write(event)).pipe(mergeMap(() => [value]))),
      catchError((error: unknown) => from(this.audit.write({ ...event, outcome: 'failure' })).pipe(
        catchError(() => [undefined]),
        mergeMap(() => throwError(() => error)),
      )),
    );
  }
}
