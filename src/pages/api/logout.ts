// Logout 3DE: apaga o cookie de sessão e volta p/ home.
import type { APIRoute } from 'astro';
import { COOKIE_NAME } from '../../lib/auth';
export const prerender = false;
function sair(redirect: (url: string) => Response) {
  const r = redirect('/');
  r.headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  return r;
}
export const POST: APIRoute = ({ redirect }) => sair(redirect);
export const GET: APIRoute = ({ redirect }) => sair(redirect);
