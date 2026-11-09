// Leitura readonly do catálogo (D1 do 3d-lib). Nunca escreve.
// MODO AMOSTRA (Marcus, 02/11/26): base atual serve só p/ desenvolvimento.
// Teto de 100 peças por consulta — nada de carregar tudo.
// Troca futura p/ base nova = 1 var no .env (D1_DATABASE_ID), sem mudar código.
import { d1query } from './d1';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { acctQuery } from './acctdb';
import { priceRule } from './plans';
export interface CatalogItem {id: number;name: string;category: string | null;categoryName: string | null;photoId: number | null;price: number;}
export const DEV_SAMPLE_LIMIT = 100;
// Regra "anunciável" — fonte única (C1): peça baixável + foto local servível.
// facets.ts importa daqui; nunca redefinir BASE/COM_ARQUIVO noutro módulo.
export const CATALOG_BASE = `i.status IN ('reposted','captured') AND i.is_adult = 0`;
// Vitrine só lista peça baixável: com documento que tenha link no Drive.
export const CATALOG_COM_ARQUIVO = `EXISTS (SELECT 1 FROM files d WHERE d.item_id = i.id AND d.kind = 'document' AND d.drive_url LIKE 'https://drive.google.com/%')`;
// Vitrine só anuncia peça com imagem destacada real e servível (decisão Marcus 04/11/26):
// sem foto, sem card. O thumb serve arquivo local (3dlib-cache) OU redireciona
// p/ miniatura do Drive (auditoria 08/11/26: cache local com 9 arquivos apagava
// a vitrine inteira) — por isso COM_FOTO aceita local_path OU drive_url, e o
// gate final (fotoAnunciavel) espelha exatamente o que o thumb serve.
export const COM_FOTO = `EXISTS (SELECT 1 FROM files f WHERE f.item_id = i.id AND f.kind = 'photo' AND ((f.local_path IS NOT NULL AND f.local_path <> '') OR f.drive_url LIKE 'https://drive.google.com/%'))`;
const CACHE_DIR = resolve(process.env.HOME ?? '/home/altas', '3dlib-cache');
// O thumb serve: arquivo local dentro do cache, ou redirect p/ miniatura do
// Drive (foto só-Drive). Sem nenhum dos dois, placeholder SVG.
// Verificação server-side (lista já é ≤100 linhas).
export function fotoServivel(localPath: unknown): boolean {
  const lp = String(localPath ?? '');
  if (!lp) return false;
  const r = resolve(lp);
  return (r === CACHE_DIR || r.startsWith(CACHE_DIR + '/')) && existsSync(r);
}
// Gate final da vitrine: anuncia o que o thumb serve (local no disco OU Drive).
export function fotoAnunciavel(localPath: unknown, driveUrl: unknown): boolean {
  if (fotoServivel(localPath)) return true;
  return String(driveUrl ?? '').startsWith('https://drive.google.com/');
}
// Extrai o ID do arquivo de um link https://drive.google.com/file/d/{id}/view
// (padrão do acervo). Null quando o formato é desconhecido.
export function driveId(driveUrl: unknown): string | null {
  const m = String(driveUrl ?? '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?[^\s]*[?&]id=)([A-Za-z0-9_-]{10,})/);
  return m ? m[1] : null;
}
// Miniatura pública do Drive p/ <img> (sem auth quando o arquivo é compartilhado).
export function driveThumb(driveUrl: unknown, largura = 800): string | null {
  const id = driveId(driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${largura}` : null;
}
// Subselects de foto (alias do item como parâmetro — listRecent/searchItems usam
// `i`, listCategories usa `i2`). Fonte única: nunca copiar esse SQL noutro módulo.
// photoDuSub traz o drive_url DA MESMA foto escolhida por photoIdSub/photoLpSub
// (mesmo ORDER BY) — gate fotoAnunciavel e thumb usam o mesmo par.
const PHOTO_COND = (a: string) => `f.item_id = ${a}.id AND f.kind = 'photo' AND ((f.local_path IS NOT NULL AND f.local_path <> '') OR f.drive_url LIKE 'https://drive.google.com/%')`;
export const photoIdSub = (a: string) => `(SELECT f.id FROM files f WHERE ${PHOTO_COND(a)} ORDER BY f.id DESC LIMIT 1)`;
export const photoLpSub = (a: string) => `(SELECT f.local_path FROM files f WHERE ${PHOTO_COND(a)} ORDER BY f.id DESC LIMIT 1)`;
export const photoDuSub = (a: string) => `(SELECT f.drive_url FROM files f WHERE ${PHOTO_COND(a)} ORDER BY f.id DESC LIMIT 1)`;
// WHERE completo da vitrine para um dado alias (C1: conds builder único).
export const catalogWhere = (alias = 'i') => alias === 'i'
  ? `${CATALOG_BASE} AND ${CATALOG_COM_ARQUIVO} AND ${COM_FOTO}`
  : `${alias}.status IN ('reposted','captured') AND ${alias}.is_adult = 0 AND EXISTS (SELECT 1 FROM files d WHERE d.item_id = ${alias}.id AND d.kind = 'document' AND d.drive_url LIKE 'https://drive.google.com/%') AND EXISTS (SELECT 1 FROM files f WHERE f.item_id = ${alias}.id AND f.kind = 'photo' AND ((f.local_path IS NOT NULL AND f.local_path <> '') OR f.drive_url LIKE 'https://drive.google.com/%'))`;
// Limpa nome de arquivo/título: tira extensões (mesmo duplas, "..zip"), troca
// separadores por espaço, remove rabo de ingestão (data + sufixo de lote:
// "...3mf20260908_1_ru") e tokens soltos de formato no meio do nome.
// Nunca inventa nome de peça.
function cleanTitle(s: string): string {
  let t = (s ?? '').trim()
    .replace(/(\.(zip|rar|7z|stl|obj|3mf|step|stp))+$/i, '')
    .replace(/(3mf|stl|obj|step|stp)?\d{8,}(_\d+)?(_[a-z0-9]{1,5})?$/i, '')
    .replace(/[_+.]+/g, ' ')
    .replace(/\b(3mf|stl|obj|step|stp)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return t;
}
export function displayName(name: string | null, fileName: string | null): string {
  const t = (name ?? '').trim();
  if (t && !/^msg-\d+$/i.test(t) && !/^algu[ée]m (tem|possui|pode)/i.test(t) && !/^(bom dia|boa (tarde|noite)|@admin|does anyone|alguem)/i.test(t)) return cleanTitle(t) || 'Peça sem título';
  const f = cleanTitle(fileName ?? '');
  if (f) return f;
  // Título é ruído e não há arquivo p/ derivar nome: genérico honesto, nunca o ruído.
  if (!t || /^msg-\d+$/i.test(t) || /^algu[ée]m (tem|possui|pode)/i.test(t) || /^(bom dia|boa (tarde|noite)|@admin|does anyone|alguem)/i.test(t)) return 'Peça sem título';
  return t;
}
export async function listRecent(limit = 24): Promise<CatalogItem[]> {
  const n = Math.min(limit, DEV_SAMPLE_LIMIT);
  const rows = await d1query(
    `SELECT i.id AS id, i.name AS name, c.slug AS category, c.name AS category_name,
      ${photoIdSub('i')} AS photoId,
      ${photoLpSub('i')} AS photoLp,
      ${photoDuSub('i')} AS photoDu,
      (SELECT f2.file_name FROM files f2 WHERE f2.item_id = i.id AND f2.kind = 'document' ORDER BY f2.id ASC LIMIT 1) AS fileName,
      (SELECT COALESCE(SUM(f3.size_bytes),0) FROM files f3 WHERE f3.item_id = i.id AND f3.kind = 'document') AS totalBytes
     FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE ${catalogWhere()} ORDER BY i.created_at DESC LIMIT ?`, [n]);
  const overs = n ? await priceOverrides(rows.map((r) => Number(r.id))) : new Map<number, number>();
  // Garantia final: só anuncia o que o thumb serve (local no disco OU Drive).
  return rows.filter((r) => fotoAnunciavel(r.photoLp, r.photoDu)).map((r) => {
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
