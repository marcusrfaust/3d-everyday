// Thumb 3DE: proxy de fotos via D1 do catálogo + cache local + fallback Drive.
// Mesmo padrão do 3d-lib (thumb com fallback 302 p/ Drive).
import type { APIRoute } from 'astro';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { d1query } from '../../../lib/d1';
export const prerender = false;
const LOCAL_CACHE_DIR = resolve(process.env.HOME ?? '/home/altas', '3dlib-cache');
const MIME: Record<string, string> = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'};
export const GET: APIRoute = async ({ params }) => {
  const fileId = Number(params.fileId);
  if (!Number.isInteger(fileId)) return new Response('Not found', {status: 404});
  const rows = await d1query(`SELECT f.local_path AS lp, f.drive_url AS du FROM files f JOIN items i ON i.id = f.item_id WHERE f.id = ? AND f.kind = 'photo' AND i.is_adult = 0 LIMIT 1`, [fileId]);
  if (!rows.length) return new Response('Not found', {status: 404});
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
  if (du && /^https:\/\/drive\.google\.com\//.test(du)) {
    return new Response(null, {status: 302, headers: {Location: du, 'Cache-Control': 'private, max-age=3600', Vary: 'Cookie'}});
  }
  return new Response('Not found', {status: 404});
};
