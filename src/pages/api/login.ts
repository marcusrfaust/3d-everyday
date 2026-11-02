// Login 3DE: email+senha contra users (scrypt). Cookie uid.assinatura.
import type { APIRoute } from 'astro';
import { acctQuery } from '../../lib/acctdb';
import { COOKIE_NAME, makeSessionCookieValue, verifyPassword, requireSecret } from '../../lib/auth';
export const prerender = false;
// Rate limit em memória: 5 tentativas/min por IP (scrypt queima CPU — RedTeam 3DE).
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || now > e.resetAt) { attempts.set(key, { count: 1, resetAt: now + WINDOW_MS }); return false; }
  e.count += 1;
  return e.count > MAX_ATTEMPTS;
}
export const POST: APIRoute = async ({ request, cookies, clientAddress, redirect }) => {
  const secret = requireSecret(import.meta.env.SESSION_SECRET);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'local';
  if (throttled(ip)) return redirect('/login?error=1');
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return redirect('/login?error=1');
  const rows = await acctQuery(`SELECT id, password_hash FROM users WHERE email = ? LIMIT 1`, [email]);
  if (!rows.length || !(await verifyPassword(password, String(rows[0].password_hash)))) {
    return redirect('/login?error=1');
  }
  const uid = Number(rows[0].id);
  cookies.set(COOKIE_NAME, makeSessionCookieValue(secret, uid), {
    httpOnly: true, path: '/', sameSite: 'lax',
    secure: import.meta.env.PROD || request.headers.get('x-forwarded-proto') === 'https',
    maxAge: 60 * 60 * 24 * 30,
  });
  return redirect('/conta');
};
