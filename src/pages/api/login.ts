// Login 3DE: email+senha contra users (scrypt). Cookie uid.assinatura.
import type { APIRoute } from 'astro';
import { acctQuery } from '../../lib/acctdb';
import { COOKIE_NAME, makeSessionCookieValue, verifyPassword } from '../../lib/auth';
export const prerender = false;
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const secret = import.meta.env.SESSION_SECRET;
  if (!email || !password || !secret) return redirect('/login?error=1');
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
