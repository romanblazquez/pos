import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

export type TokenRole = 'seller' | 'customer' | 'admin' | 'service';
export type TokenAudience = 'marketplace-api' | 'admin-api' | 'seller-api' | 'internal-api';

export interface JwtPayload {
  sub: string;
  sid: string;
  role: TokenRole;
  email: string;
  customerId?: string;
  sellerId?: string;
  aud?: string | string[];
  iss?: string;
  jti?: string;
  iat?: number;
  nbf?: number;
  exp?: number;
}

export interface SignTokenInput {
  sub: string;
  sid: string;
  role: TokenRole;
  email: string;
  audience: TokenAudience;
  customerId?: string;
  sellerId?: string;
}

const ISSUER = process.env.JWT_ISSUER ?? process.env.API_BASE_URL ?? 'retail-os-api';
const ACCEPTED_AUDIENCES: TokenAudience[] = [
  'marketplace-api', 'admin-api', 'seller-api', 'internal-api',
];

function decodePem(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const decoded = value.includes('BEGIN ') ? value : Buffer.from(value, 'base64').toString('utf8');
  return decoded.replace(/\\n/g, '\n');
}

function signingConfig(): {
  signingKey: jwt.Secret;
  verificationKey: jwt.Secret;
  algorithm: 'RS256' | 'HS256';
  keyId: string;
} {
  const privateKey = decodePem(process.env.JWT_PRIVATE_KEY);
  const publicKey = decodePem(process.env.JWT_PUBLIC_KEY);
  if (privateKey && publicKey) {
    return {
      signingKey: privateKey,
      verificationKey: publicKey,
      algorithm: 'RS256',
      keyId: process.env.JWT_KEY_ID ?? 'primary',
    };
  }

  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required in production');
  }
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters outside production');
  }
  return { signingKey: secret, verificationKey: secret, algorithm: 'HS256', keyId: 'development' };
}

function verificationKeyFor(token: string, current: ReturnType<typeof signingConfig>): jwt.Secret {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header.kid || decoded.header.kid === current.keyId) return current.verificationKey;
  const previousRaw = process.env.JWT_PREVIOUS_PUBLIC_KEYS;
  if (!previousRaw) throw new Error('Unknown JWT signing key');
  const previous = JSON.parse(previousRaw) as Record<string, string>;
  const key = decodePem(previous[decoded.header.kid]);
  if (!key) throw new Error('Unknown JWT signing key');
  return key;
}

export function signToken(input: SignTokenInput, expiresInSeconds = 600): string {
  const { signingKey, algorithm, keyId } = signingConfig();
  return jwt.sign(
    {
      sub: input.sub,
      sid: input.sid,
      role: input.role,
      email: input.email,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.sellerId ? { sellerId: input.sellerId } : {}),
    },
    signingKey,
    {
      algorithm,
      issuer: ISSUER,
      audience: input.audience,
      jwtid: randomUUID(),
      keyid: keyId,
      expiresIn: expiresInSeconds,
      notBefore: 0,
    },
  );
}

export function verifyToken(token: string): JwtPayload {
  const config = signingConfig();
  return jwt.verify(token, verificationKeyFor(token, config), {
    algorithms: [config.algorithm],
    issuer: ISSUER,
    audience: ACCEPTED_AUDIENCES as [TokenAudience, ...TokenAudience[]],
    clockTolerance: 5,
  }) as unknown as JwtPayload;
}
