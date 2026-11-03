// Allowlist CSRF p/ métodos não-safe (substitui o checkOrigin nativo do Astro).
// Motivo: atrás do túnel cloudflared o Host interno é localhost:4322 enquanto o
// Origin do browser é https://3de.focol.ai → o check nativo (boolean, sem
// allowlist no Astro 5.18) responde 403 p/ todo POST de form em produção.
// Regra: método não-safe (POST/PUT/PATCH/DELETE) com Origin ou Referer presente
// e fora da allowlist → 403. Sem ambos (não-browser) → passa (SameSite=Lax +
// ausência de credenciais cross-site já mitiga; igual ao fail-open nativo).
import { defineMiddleware } from 'astro:middleware';

const ALLOWED_HOSTS = new Set(['3de.focol.ai', 'localhost:4322', '127.0.0.1:4322', 'localhost', '127.0.0.1']);
// Previews locais efêmeros: liberar via env com nomes exatos, nunca wildcard.
// Ex.: PREVIEW_HOSTS="abc123.trycloudflare.com,xyz.ngrok.io"
const EXTRA_HOSTS = new Set(
  (process.env.PREVIEW_HOSTS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
);
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostAllowed(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.host.toLowerCase();
    return ALLOWED_HOSTS.has(host) || EXTRA_HOSTS.has(host);
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  if (!UNSAFE.has(request.method)) return next();
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  // Nenhum dos dois (curl, jobs internos, clientes sem Origin) → passa.
  if (!origin && !referer) return next();
  if (origin && hostAllowed(origin)) return next();
  if (!origin && referer && hostAllowed(referer)) return next();
  return new Response(`Cross-site ${request.method} submissions are forbidden`, { status: 403 });
});
