import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!hex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set in production');
    }
    // Dev fallback — deterministic, never use in production
    return Buffer.alloc(32, 'dev');
  }
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return key;
}

/** Encrypt a credentials object. Returns `{ _enc: "iv:tag:ciphertext" }`. */
export function encryptCredentials(creds: Record<string, string>): Record<string, string> {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const buf = Buffer.concat([cipher.update(JSON.stringify(creds), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { _enc: `${iv.toString('hex')}:${tag.toString('hex')}:${buf.toString('hex')}` };
}

/** Decrypt a stored credentials record. Handles legacy plaintext gracefully. */
export function decryptCredentials(stored: Record<string, unknown>): Record<string, string> {
  const enc = stored._enc as string | undefined;
  if (!enc) return stored as Record<string, string>;

  const [ivHex, tagHex, cipherHex] = enc.split(':');
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return JSON.parse(plain.toString('utf8')) as Record<string, string>;
}
