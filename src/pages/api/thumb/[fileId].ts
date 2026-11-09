// Thumb 3DE: foto local via D1 do catálogo; sem arquivo, placeholder neutro.
// (O gate de download resolve o drive_url do documento — thumb é só <img>.)
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { d1query } from '../../../lib/d1';
import { driveThumb } from '../../../lib/catalog';
export const prerender = false;
const LOCAL_CACHE_DIR = resolve(process.env.HOME ?? '/home/altas', '3dlib-cache');
const MIME: Record<string, string> = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'};
// Placeholder neutro: thumb nunca devolve imagem quebrada — sem foto real, SVG 200.
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" font-family="sans-serif" font-size="26" fill="#999" text-anchor="middle">3d-Everyday</text></svg>`;
function semFoto(): Response {
  return new Response(PLACEHOLDER_SVG, {status: 200, headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400'}});
}
export const GET: APIRoute = async ({ params }) => {
  const fileId = Number(params.fileId);
  if (!Number.isInteger(fileId)) return new Response('Not found', {status: 404});
  const rows = await d1query(`SELECT f.local_path AS lp, f.drive_url AS du FROM files f JOIN items i ON i.id = f.item_id WHERE f.id = ? AND f.kind = 'photo' AND i.is_adult = 0 AND i.status IN ('reposted','captured') LIMIT 1`, [fileId]);
  if (!rows.length) return semFoto();
  const lp = String(rows[0].lp ?? '');
  const resolved = resolve(lp || '.');
  if (lp && (resolved === LOCAL_CACHE_DIR || resolved.startsWith(LOCAL_CACHE_DIR + '/'))) {
    try {
      const buf = await readFile(resolved);
      const ext = resolved.slice(resolved.lastIndexOf('.')).toLowerCase();
      return new Response(buf, {status: 200, headers: {'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=86400'}});
    } catch { /* sem arquivo local: tenta Drive */ }
  }
  const dt = driveThumb(String(rows[0].du ?? ''));
  if (dt) return Response.redirect(dt, 302);
  return semFoto();
};
