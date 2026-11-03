// Allowlist CSRF p/ POSTs de form (substitui o checkOrigin nativo do Astro).
// Motivo: atrás do túnel cloudflared o Host interno é localhost:4322 enquanto o
// Origin do browser é https://3de.focol.ai → o check nativo (boolean, sem
// allowlist no Astro 5.18) responde 403 p/ todo POST de form em produção.
// Este middleware replica a proteção (bloqueia form POST cross-site) com hosts
// explícitos permitidos. GET/HEAD/OPTIONS passam direto (como no nativo).
import { defineMiddleware } from 'astro:middleware';

const FORM_CONTENT_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
const ALLOWED_HOSTS = new Set(['3de.focol.ai', 'localhost:4322', '127.0.0.1:4322', 'localhost', '127.0.0.1']);

function hostAllowed(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (ALLOWED_HOSTS.has(u.host)) return true;
    if (u.hostname.endsWith('.trycloudflare.com')) return true; // túneis efêmeros de teste
    return false;
  } catch {
    return false;
  }
}

function isFormLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return FORM_CONTENT_TYPES.some((t) => ct.includes(t));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return next();
  if (isFormLike(request.headers.get('content-type')) && !hostAllowed(request.headers.get('origin') ?? '')) {
    return new Response(`Cross-site ${request.method} form submissions are forbidden`, { status: 403 });
  }
  return next();
});
