// Gate de download via POST (RedTeam 3DE: débito nunca em GET — evita CSRF).
// GET mostra confirmação com preço/saldo; POST debita e redireciona ao Drive.
// Ordem: resolve o link ANTES de debitar — nunca cobra por arquivo inexistente.
import type { APIRoute } from 'astro';
import { acctQuery } from '../../../lib/acctdb';
import { d1query } from '../../../lib/d1';
import { sessionUid, requireSecret } from '../../../lib/auth';
import { debitDownload } from '../../../lib/credits';
export const prerender = false;
async function resolveLink(itemId: number): Promise<string | null> {
  const files = await d1query(`SELECT drive_url FROM files WHERE item_id = ? AND kind = 'document' AND drive_url IS NOT NULL AND drive_url <> '' ORDER BY id ASC LIMIT 1`, [itemId]);
  const url = files.length ? String(files[0].drive_url) : null;
  if (!url || !/^https:\/\/drive\.google\.com\//.test(url)) return null;
  return url;
}
export const GET: APIRoute = async ({ params, cookies, redirect }) => {
  const uid = sessionUid(cookies.get('session3de')?.value, import.meta.env.SESSION_SECRET);
  if (!uid) return redirect('/login');
  return redirect(`/modelo/${params.itemId}`);
};
export const POST: APIRoute = async ({ params, cookies, redirect }) => {
  requireSecret(import.meta.env.SESSION_SECRET);
  const uid = sessionUid(cookies.get('session3de')?.value, import.meta.env.SESSION_SECRET);
  if (!uid) return redirect('/login');
  const itemId = Number(params.itemId);
  if (!Number.isInteger(itemId)) return new Response('peça inválida', {status: 400});
  const users = await acctQuery(`SELECT plan FROM users WHERE id = ? LIMIT 1`, [uid]);
  if (!users.length) return redirect('/login');
  const url = await resolveLink(itemId);
  if (!url) return new Response('Arquivo ainda sem link de download. Tente mais tarde.', {status: 404});
  const month = new Date().toISOString().slice(0, 7);
  const r = await debitDownload(uid, String(users[0].plan), itemId, month);
  if (!r.ok) {
    return new Response(`Sem créditos suficientes (${r.saldo} disponíveis, esta peça custa ${r.price}). Fale com o suporte para fazer upgrade de plano.`, {status: 402});
  }
  return redirect(url);
};
