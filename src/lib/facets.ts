// Busca + facetas (categorias/tags) sobre o catálogo readonly. Teto de amostra mantido.
// C1: regra "anunciável" e subselects de foto vêm de catalog.ts (fonte única) —
// nunca redefinir SQL de vitrine aqui. C2: matemática de página via pagination.ts.
import { d1query } from './d1';
import { priceRule } from './plans';
import { displayName, priceOverrides, DEV_SAMPLE_LIMIT, catalogWhere, photoIdSub, photoLpSub, fotoServivel, type CatalogItem } from './catalog';
import { clampPerPage, normalizePage, pageOffset } from './pagination';
export interface Facet {slug: string;name: string;count: number;photoId?: number | null;}
export async function listCategories(): Promise<Facet[]> {
  const rows = await d1query(
    `SELECT c.slug AS slug, c.name AS name, COUNT(*) AS n,
      (SELECT f.id FROM files f JOIN items i2 ON i2.id = f.item_id WHERE i2.category_id = c.id AND f.kind = 'photo' AND f.local_path IS NOT NULL AND f.local_path <> '' AND ${catalogWhere('i2')} ORDER BY f.id DESC LIMIT 1) AS photoId,
      (SELECT f.local_path FROM files f JOIN items i2 ON i2.id = f.item_id WHERE i2.category_id = c.id AND f.kind = 'photo' AND f.local_path IS NOT NULL AND f.local_path <> '' AND ${catalogWhere('i2')} ORDER BY f.id DESC LIMIT 1) AS photoLp
     FROM items i JOIN categories c ON c.id = i.category_id
     WHERE ${catalogWhere()} GROUP BY c.slug, c.name ORDER BY n DESC LIMIT ${DEV_SAMPLE_LIMIT}`, []);
  // Capa só com arquivo servível no cache; sem ele, bloco de inicial (sem placeholder).
  return rows.map((r) => ({slug: String(r.slug), name: String(r.name ?? r.slug), count: Number(r.n), photoId: r.photoId == null || !fotoServivel(r.photoLp) ? null : Number(r.photoId)}));
}
export async function listTags(limit = 40): Promise<Facet[]> {
  const rows = await d1query(
    `SELECT t.tag AS slug, COUNT(DISTINCT t.item_id) AS n FROM item_tags t JOIN items i ON i.id = t.item_id
     WHERE ${catalogWhere()} GROUP BY t.tag ORDER BY n DESC LIMIT ?`, [clampPerPage(limit)]);
  return rows.map((r) => ({slug: String(r.slug), name: String(r.slug), count: Number(r.n)}));
}
export async function searchItems(opts: {q?: string;category?: string;tag?: string;limit?: number;page?: number;perPage?: number}): Promise<CatalogItem[]> {
  const conds = [catalogWhere()];
  const params: unknown[] = [];
  if (opts.category) { conds.push(`c.slug = ?`); params.push(opts.category); }
  if (opts.tag) { conds.push(`EXISTS (SELECT 1 FROM item_tags t WHERE t.item_id = i.id AND t.tag = ?)`); params.push(opts.tag); }
  if (opts.q) { conds.push(`i.name LIKE ?`); params.push(`%${opts.q}%`); }
  // Paginação (Marcus 04/11/26): ?pagina= na busca/categoria. Sem page (chamada
  // antiga), comporta-se como antes: primeiras `limit` peças. C2: matemática
  // centralizada em pagination.ts (clamp inferior aqui; teto nas páginas, que
  // conhecem o total).
  const perPage = clampPerPage(opts.perPage ?? opts.limit ?? 24);
  const page = normalizePage(opts.page ?? 1);
  params.push(perPage, pageOffset(page, perPage));
  const rows = await d1query(
    `SELECT i.id AS id, i.name AS name, c.slug AS category, c.name AS category_name,
      ${photoIdSub('i')} AS photoId,
      ${photoLpSub('i')} AS photoLp,
      (SELECT f2.file_name FROM files f2 WHERE f2.item_id = i.id AND f2.kind = 'document' ORDER BY f2.id ASC LIMIT 1) AS fileName,
      (SELECT COALESCE(SUM(f3.size_bytes),0) FROM files f3 WHERE f3.item_id = i.id AND f3.kind = 'document') AS totalBytes
     FROM items i LEFT JOIN categories c ON c.id = i.category_id
     WHERE ${conds.join(' AND ')} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`, params);
  const overs = rows.length ? await priceOverrides(rows.map((r) => Number(r.id))) : new Map<number, number>();
  // Garantia final: só anuncia o que o thumb serve (arquivo existe no cache).
  return rows.filter((r) => fotoServivel(r.photoLp)).map((r) => {
    const id = Number(r.id);
    return {id, name: displayName(String(r.name ?? ''), r.fileName == null ? null : String(r.fileName)), category: r.category == null ? null : String(r.category), categoryName: r.category_name == null ? null : String(r.category_name), photoId: r.photoId == null ? null : Number(r.photoId), price: overs.get(id) ?? priceRule(Number(r.totalBytes ?? 0))};
  });
}

// Total de peças do filtro (para a navegação de páginas). Mesmos conds da
// busca; o descarte de foto sumida do disco é pós-filtro (última página pode
// vir mais curta quando o cache está incompleto — degradê honesto).
export async function countItems(opts: {q?: string;category?: string;tag?: string}): Promise<number> {
  const conds = [catalogWhere()];
  const params: unknown[] = [];
  if (opts.category) { conds.push(`c.slug = ?`); params.push(opts.category); }
  if (opts.tag) { conds.push(`EXISTS (SELECT 1 FROM item_tags t WHERE t.item_id = i.id AND t.tag = ?)`); params.push(opts.tag); }
  if (opts.q) { conds.push(`i.name LIKE ?`); params.push(`%${opts.q}%`); }
  const rows = await d1query(
    `SELECT COUNT(*) AS n FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE ${conds.join(' AND ')}`, params);
  return Number(rows[0]?.n ?? 0);
}
