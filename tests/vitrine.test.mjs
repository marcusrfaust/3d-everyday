// Vitrine só anuncia peça com foto real (decisão Marcus 04/11/26).
// Roda: node --test tests/vitrine.test.mjs (sem rede, lê o fonte).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalog = readFileSync(path.join(root, 'src/lib/catalog.ts'), 'utf8');
const facets = readFileSync(path.join(root, 'src/lib/facets.ts'), 'utf8');

test('catalog exporta COM_FOTO exigindo files.kind photo com arquivo real', () => {
  assert.ok(catalog.includes('COM_FOTO'), 'catalog.ts deve exportar COM_FOTO');
  assert.ok(catalog.includes("f.kind = 'photo'"), 'COM_FOTO deve exigir kind photo');
});

test('listRecent filtra sem foto via fonte única (C1: catalogWhere)', () => {
  assert.ok(catalog.includes('catalogWhere'), 'catalog.ts deve exportar catalogWhere');
  assert.ok(catalog.includes('WHERE ${catalogWhere()}'), 'listRecent WHERE usa a fonte única');
});

test('facetas e busca usam o mesmo filtro de foto via fonte única (C1)', () => {
  assert.ok(!/const BASE =/.test(facets), 'facets.ts não redefine BASE (fonte única em catalog.ts)');
  assert.ok(!/const COM_ARQUIVO =/.test(facets), 'facets.ts não redefine COM_ARQUIVO');
  assert.ok(facets.includes('catalogWhere'), 'facets.ts importa/usa catalogWhere');
  const usos = facets.match(/catalogWhere\(/g) ?? [];
  // import + listCategories(2: capa+WHERE) + listTags + searchItems + countItems = 5+
  assert.ok(usos.length >= 5, `esperava 5+ usos de catalogWhere, achei ${usos.length}`);
  assert.ok(facets.includes('photoIdSub') && facets.includes('photoLpSub'), 'facets usa subselects de foto da fonte única');
});

test('ModelCard mantém fallback só como rede de segurança', () => {
  const card = readFileSync(path.join(root, 'src/components/ModelCard.astro'), 'utf8');
  assert.ok(card.includes('Sem foto'), 'fallback defensivo deve existir');
});

test('gate final anuncia o que o thumb serve: local OU Drive (auditoria 08/11/26)', () => {
  assert.ok(catalog.includes('fotoAnunciavel'), 'catalog.ts deve exportar fotoAnunciavel');
  assert.ok(catalog.includes('filter((r) => fotoAnunciavel(r.photoLp, r.photoDu))'), 'listRecent usa o gate Drive');
  assert.ok(facets.includes('fotoAnunciavel(r.photoLp, r.photoDu)'), 'facets usa o gate Drive');
  assert.ok(catalog.includes('photoDuSub'), 'fonte única expõe photoDuSub');
  assert.ok(facets.includes('photoDuSub'), 'facets usa photoDuSub');
  assert.ok(!facets.includes('fotoServivel('), 'facets não usa mais o gate só-local');
});

test('driveId/driveThumb convertem link do acervo em miniatura pública', () => {
  assert.ok(catalog.includes('export function driveId'), 'catalog.ts deve exportar driveId');
  assert.ok(catalog.includes('export function driveThumb'), 'catalog.ts deve exportar driveThumb');
  assert.ok(catalog.includes('drive.google.com/thumbnail'), 'thumb usa endpoint público de miniatura');
});

test('thumb redireciona p/ Drive quando sem arquivo local', () => {
  const thumb = readFileSync(path.join(root, 'src/pages/api/thumb/[fileId].ts'), 'utf8');
  assert.ok(thumb.includes('Response.redirect'), 'thumb faz redirect p/ miniatura do Drive');
});

test('categorias exibem rótulo PT-BR sem tocar no slug', () => {
  assert.ok(facets.includes('rotuloCategoria'), 'listCategories aplica rótulo PT-BR');
});
