import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export function verifyMercadoPagoSignature(
  signature: string | undefined,
  requestId: string | undefined,
  dataId: string,
): void {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Webhook verification is not configured');
    }
    return;
  }
  if (!signature || !requestId) throw new UnauthorizedException('Missing webhook signature headers');

  const parts = Object.fromEntries(
    signature.split(',').map((part) => part.trim().split('=', 2)),
  ) as Record<string, string>;
  const timestamp = parts['ts'];
  const received = parts['v1'];
  if (!timestamp || !received) throw new UnauthorizedException('Malformed webhook signature');

  const parsedTimestamp = Number(timestamp);
  const timestampSeconds = parsedTimestamp > 1_000_000_000_000
    ? Math.floor(parsedTimestamp / 1000)
    : parsedTimestamp;
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    throw new UnauthorizedException('Webhook timestamp is outside the allowed window');
  }

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(received, 'hex');
  } catch {
    throw new UnauthorizedException('Malformed webhook signature');
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new UnauthorizedException('Webhook signature mismatch');
  }
}
