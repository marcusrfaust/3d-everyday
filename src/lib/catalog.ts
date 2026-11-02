// Leitura readonly do catálogo (D1 do 3d-lib). Nunca escreve.
import { d1query } from './d1';
export interface CatalogItem {id: number;name: string;category: string | null;photoId: number | null;}
const BASE = `i.status IN ('reposted','captured') AND i.is_adult = 0`;
export async function listRecent(limit = 24): Promise<CatalogItem[]> {
  const rows = await d1query(`SELECT i.id AS id, i.name AS name, c.slug AS category,(SELECT f.id FROM files f WHERE f.item_id = i.id AND f.kind = 'photo' ORDER BY f.id DESC LIMIT 1) AS photoId FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE ${BASE} ORDER BY i.created_at DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({id: Number(r.id),name: String(r.name ?? ''),category: r.category == null ? null : String(r.category),photoId: r.photoId == null ? null : Number(r.photoId)}));
}
export async function countItems(): Promise<number> {
  const rows = await d1query(`SELECT count(*) AS n FROM items i WHERE ${BASE}`);
  return Number(rows[0]?.n ?? 0);
}
