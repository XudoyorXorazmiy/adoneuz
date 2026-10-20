import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Bot tokenlari va kalitlar (*_enc) — AES-256-GCM. Kalit SECRET_KEY dan sha256 bilan olinadi. */
function key(): Buffer {
  const s = process.env.SECRET_KEY;
  if (!s) throw new Error('SECRET_KEY sozlanmagan');
  return createHash('sha256').update(s).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${data.toString('base64url')}`;
}

export function decryptJson<T = unknown>(payload: string): T {
  const [v, ivB, tagB, dataB] = payload.split('.');
  if (v !== 'v1' || !ivB || !tagB || !dataB) throw new Error("Shifrlangan sozlama formati noto'g'ri");
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  const out = Buffer.concat([decipher.update(Buffer.from(dataB, 'base64url')), decipher.final()]);
  return JSON.parse(out.toString('utf8')) as T;
}
