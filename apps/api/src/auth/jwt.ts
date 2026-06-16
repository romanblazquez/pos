import jwt from 'jsonwebtoken';

export type TokenRole = 'seller' | 'customer' | 'admin';

export interface JwtPayload {
  sub: string;    // entity id
  role: TokenRole;
  email: string;
  iat?: number;
  exp?: number;
}

const SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret-change-in-production';
const EXPIRES_IN = '30d';

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
