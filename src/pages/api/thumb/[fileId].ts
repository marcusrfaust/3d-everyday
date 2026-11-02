// Thumb 3DE: proxy de fotos via D1 do catálogo + cache local + fallback Drive.
// Mesmo padrão do 3d-lib (thumb com fallback 302 p/ Drive).
import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { d1query } from '../../../lib/d1';
export const prerender = false;
const LOCAL_CACHE_DIR = resolve(process.env.HOME ?? '/home/altas', '3dlib-cache');
const MIME: Record<string, string> = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'};
// Placeholder neutro: thumb nunca devolve imagem quebrada — sem foto real, SVG 200.
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="26" fill="#999" text-anchor="middle">3d-Everyday</text></svg>`;
function semFoto(): Response {
  return new Response(PLACEHOLDER_SVG, {status: 200, headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400'}});
}
// Drive /file/d/.../view devolve página HTML — <img> quebraria. Converte p/
// thumbnail direto (público, sem API key); uc/lh3 já são diretos.
function driveDirect(du: string | null): string | null {
  if (!du) return null;
  let m = du.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  m = du.match(/^https:\/\/drive\.google\.com\/open\?id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1000`;
  if (/^https:\/\/drive\.google\.com\/uc\?/.test(du)) return du;
  if (/^https:\/\/lh3\.googleusercontent\.com\//.test(du)) return du;
  return null;
}
export const GET: APIRoute = async ({ params }) => {
  const fileId = Number(params.fileId);
  if (!Number.isInteger(fileId)) return new Response('Not found', {status: 404});
  const rows = await d1query(`SELECT f.local_path AS lp, f.drive_url AS du FROM files f JOIN items i ON i.id = f.item_id WHERE f.id = ? AND f.kind = 'photo' AND i.is_adult = 0 LIMIT 1`, [fileId]);
  if (!rows.length) return semFoto();
  const lp = String(rows[0].lp ?? '');
  const du = rows[0].du == null ? null : String(rows[0].du);
  const resolved = resolve(lp || '.');
  if (lp && (resolved === LOCAL_CACHE_DIR || resolved.startsWith(LOCAL_CACHE_DIR + '/'))) {
    try {
      const info = await stat(resolved);
      const buf = await readFile(resolved);
      const ext = resolved.slice(resolved.lastIndexOf('.')).toLowerCase();
      return new Response(buf, {status: 200, headers: {'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=86400'}});
    } catch { /* cai p/ Drive */ }
  }
  const direct = driveDirect(du);
  if (direct) {
    return new Response(null, {status: 302, headers: {Location: direct, 'Cache-Control': 'private, max-age=3600', Vary: 'Cookie'}});
  }
  return semFoto();
};
