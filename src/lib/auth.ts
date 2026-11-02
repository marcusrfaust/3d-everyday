// Sessão 3DE: cookie uid.assinatura (HMAC-SHA256 com SESSION_SECRET próprio).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { scrypt, randomBytes, timingSafeEqual as tse } from 'node:crypto';
import { promisify } from 'node:util';
export const COOKIE_NAME = 'session3de';
const scryptAsync = promisify(scrypt);
function sign(secret: string, uid: number): string {
  return createHmac('sha256', secret).update(`uid:${uid}`).digest('hex');
}
export function makeSessionCookieValue(secret: string, uid: number): string {
  return `${uid}.${sign(secret, uid)}`;
}
export function requireSecret(secret: string | undefined): string {
  if (!secret) throw new Error('SESSION_SECRET não configurado — sessões desabilitadas.');
  return secret;
}
export function sessionUid(cookieValue: string | undefined, secret: string | undefined): number | null {
  if (!cookieValue || !secret) return null;
  const [uidStr, sig] = cookieValue.split('.');
  const uid = Number(uidStr);
  if (!Number.isInteger(uid) || uid <= 0 || !sig) return null;
  const expected = sign(secret, uid);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? uid : null;
}
// Senha: scrypt$salt$hash. Simples, sem dependência nova.
const MAX_PASSWORD_LEN = 256;
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const h = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${h.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LEN) return false;
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const h = (await scryptAsync(password, salt, 64)) as Buffer;
  const a = Buffer.from(h.toString('hex'));
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return tse(a, b);
}
