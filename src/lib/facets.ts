// Busca + facetas (categorias/tags) sobre o catálogo readonly. Teto de amostra mantido.
import { d1query } from './d1';
import { priceRule } from './plans';
import { displayName, priceOverrides, DEV_SAMPLE_LIMIT, type CatalogItem } from './catalog';
const BASE = `i.status IN ('reposted','captured') AND i.is_adult = 0`;
// Vitrine só lista peça baixável: com documento que tenha link no Drive.
const COM_ARQUIVO = `EXISTS (SELECT 1 FROM files d WHERE d.item_id = i.id AND d.kind = 'document' AND d.drive_url LIKE 'https://drive.google.com/%')`;
export interface Facet {slug: string;name: string;count: number;photoId?: number | null;}
export async function listCategories(): Promise<Facet[]> {
  const rows = await d1query(
    `SELECT c.slug AS slug, c.name AS name, COUNT(*) AS n,
      (SELECT f.id FROM files f JOIN items i2 ON i2.id = f.item_id WHERE i2.category_id = c.id AND i2.status IN ('reposted','captured') AND i2.is_adult = 0 AND f.kind = 'photo' AND (f.local_path IS NOT NULL AND f.local_path <> '' OR f.drive_url LIKE 'https://drive.google.com/%') ORDER BY f.id DESC LIMIT 1) AS photoId
     FROM items i JOIN categories c ON c.id = i.category_id
     WHERE ${BASE} AND ${COM_ARQUIVO} GROUP BY c.slug, c.name ORDER BY n DESC LIMIT ${DEV_SAMPLE_LIMIT}`, []);
  return rows.map((r) => ({slug: String(r.slug), name: String(r.name ?? r.slug), count: Number(r.n), photoId: r.photoId == null ? null : Number(r.photoId)}));
}
export async function listTags(limit = 40): Promise<Facet[]> {
  const rows = await d1query(
    `SELECT t.tag AS slug, COUNT(DISTINCT t.item_id) AS n FROM item_tags t JOIN items i ON i.id = t.item_id
     WHERE ${BASE} GROUP BY t.tag ORDER BY n DESC LIMIT ?`, [Math.min(limit, DEV_SAMPLE_LIMIT)]);
  return rows.map((r) => ({slug: String(r.slug), name: String(r.slug), count: Number(r.n)}));
}
export async function searchItems(opts: {q?: string;category?: string;tag?: string;limit?: number}): Promise<CatalogItem[]> {
  const conds = [BASE, COM_ARQUIVO];
  const params: unknown[] = [];
  if (opts.category) { conds.push(`c.slug = ?`); params.push(opts.category); }
  if (opts.tag) { conds.push(`EXISTS (SELECT 1 FROM item_tags t WHERE t.item_id = i.id AND t.tag = ?)`); params.push(opts.tag); }
  if (opts.q) { conds.push(`i.name LIKE ?`); params.push(`%${opts.q}%`); }
  const n = Math.min(opts.limit ?? 24, DEV_SAMPLE_LIMIT);
  params.push(n);
  const rows = await d1query(
    `SELECT i.id AS id, i.name AS name, c.slug AS category, c.name AS category_name,
      (SELECT f.id FROM files f WHERE f.item_id = i.id AND f.kind = 'photo' AND (f.local_path IS NOT NULL AND f.local_path <> '' OR f.drive_url LIKE 'https://drive.google.com/%') ORDER BY f.id DESC LIMIT 1) AS photoId,
      (SELECT f2.file_name FROM files f2 WHERE f2.item_id = i.id AND f2.kind = 'document' ORDER BY f2.id ASC LIMIT 1) AS fileName,
      (SELECT COALESCE(SUM(f3.size_bytes),0) FROM files f3 WHERE f3.item_id = i.id AND f3.kind = 'document') AS totalBytes
     FROM items i LEFT JOIN categories c ON c.id = i.category_id
     WHERE ${conds.join(' AND ')} ORDER BY i.created_at DESC LIMIT ?`, params);
  const overs = rows.length ? await priceOverrides(rows.map((r) => Number(r.id))) : new Map<number, number>();
  return rows.map((r) => {
    const id = Number(r.id);
    return {id, name: displayName(String(r.name ?? ''), r.fileName == null ? null : String(r.fileName)), category: r.category == null ? null : String(r.category), categoryName: r.category_name == null ? null : String(r.category_name), photoId: r.photoId == null ? null : Number(r.photoId), price: overs.get(id) ?? priceRule(Number(r.totalBytes ?? 0))};
  });
}
