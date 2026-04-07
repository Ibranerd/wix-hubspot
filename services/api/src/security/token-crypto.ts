import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';

function buildKey(masterKey: string): Buffer {
  if (!masterKey) {
    throw new Error('Missing ENCRYPTION_MASTER_KEY');
  }

  return createHash('sha256').update(masterKey).digest();
}

export function encryptSecret(value: string, masterKey: string): string {
  const iv = randomBytes(12);
  const key = buildKey(masterKey);
  const cipher = createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString('base64url'), encrypted.toString('base64url'), tag.toString('base64url')].join('.');
}

export function decryptSecret(value: string, masterKey: string): string {
  const [ivPart, payloadPart, tagPart] = value.split('.');
  if (!ivPart || !payloadPart || !tagPart) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const payload = Buffer.from(payloadPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  const key = buildKey(masterKey);

  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
}
