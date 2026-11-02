// Leitura readonly do catálogo (D1 do 3d-lib). Nunca escreve.
// MODO AMOSTRA (Marcus, 02/11/26): base atual serve só p/ desenvolvimento.
// Teto de 100 peças por consulta — nada de carregar tudo.
// Troca futura p/ base nova = 1 var no .env (D1_DATABASE_ID), sem mudar código.
import { d1query } from './d1';
import { acctQuery } from './acctdb';
import { priceRule } from './plans';
export interface CatalogItem {id: number;name: string;category: string | null;categoryName: string | null;photoId: number | null;price: number;}
export const DEV_SAMPLE_LIMIT = 100;
const BASE = `i.status IN ('reposted','captured') AND i.is_adult = 0`;
// Títulos do Telegram vêm crus ("alguém tem stl?", "msg-204471"): exibe o nome do
// arquivo quando o título não diz nada — nunca inventa nome de peça.
export function displayName(name: string | null, fileName: string | null): string {
  const t = (name ?? '').trim();
  if (t && !/^msg-\d+$/i.test(t) && !/^algu[ée]m (tem|possui|pode)/i.test(t) && !/^(bom dia|boa (tarde|noite)|@admin|does anyone|alguem)/i.test(t)) return t;
  const f = (fileName ?? '').trim().replace(/\.(zip|rar|7z|stl|obj|3mf)$/i, '').replace(/[_+.]+/g, ' ').trim();
  return f || t || 'Peça sem título';
}
export async function listRecent(limit = 24): Promise<CatalogItem[]> {
  const n = Math.min(limit, DEV_SAMPLE_LIMIT);
  const rows = await d1query(
    `SELECT i.id AS id, i.name AS name, c.slug AS category, c.name AS category_name,
      (SELECT f.id FROM files f WHERE f.item_id = i.id AND f.kind = 'photo' ORDER BY f.id DESC LIMIT 1) AS photoId,
      (SELECT f2.file_name FROM files f2 WHERE f2.item_id = i.id AND f2.kind = 'document' ORDER BY f2.id ASC LIMIT 1) AS fileName,
      (SELECT COALESCE(SUM(f3.size_bytes),0) FROM files f3 WHERE f3.item_id = i.id AND f3.kind = 'document') AS totalBytes
     FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE ${BASE} ORDER BY i.created_at DESC LIMIT ?`, [n]);
  const overs = n ? await priceOverrides(rows.map((r) => Number(r.id))) : new Map<number, number>();
  return rows.map((r) => {
    const id = Number(r.id);
    return {id, name: displayName(String(r.name ?? ''), r.fileName == null ? null : String(r.fileName)), category: r.category == null ? null : String(r.category), categoryName: r.category_name == null ? null : String(r.category_name), photoId: r.photoId == null ? null : Number(r.photoId), price: overs.get(id) ?? priceRule(Number(r.totalBytes ?? 0))};
  });
}
// Override manual sai do banco de CONTAS (este app nunca escreve no catálogo).
export async function priceOverrides(ids: number[]): Promise<Map<number, number>> {
  const m = new Map<number, number>();
  if (!ids.length) return m;
  const ph = ids.map(() => '?').join(',');
  const rows = await acctQuery(`SELECT item_id, price FROM item_prices WHERE item_id IN (${ph})`, ids as unknown[]);
  for (const r of rows) m.set(Number(r.item_id), Number(r.price));
  return m;
}
