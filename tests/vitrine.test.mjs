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

test('listRecent filtra sem foto (sem anúncio sem imagem)', () => {
  assert.ok(catalog.includes('AND ${COM_FOTO}'), 'listRecent WHERE deve incluir COM_FOTO');
});

test('facetas e busca usam o mesmo filtro de foto', () => {
  assert.ok(facets.includes('COM_FOTO'), 'facets.ts deve importar/usar COM_FOTO');
  const usos = facets.match(/COM_FOTO/g) ?? [];
  // import + listCategories + listTags + searchItems(cond) = 4+
  assert.ok(usos.length >= 4, `esperava 4+ usos de COM_FOTO, achei ${usos.length}`);
});

test('ModelCard mantém fallback só como rede de segurança', () => {
  const card = readFileSync(path.join(root, 'src/components/ModelCard.astro'), 'utf8');
  assert.ok(card.includes('Sem foto'), 'fallback defensivo deve existir');
});

test('fotoServivel exige arquivo local dentro do cache (thumb nunca placeholder)', () => {
  assert.ok(catalog.includes('fotoServivel'), 'catalog.ts deve exportar fotoServivel');
  assert.ok(catalog.includes('existsSync'), 'fotoServivel verifica o disco');
  assert.ok(catalog.includes('3dlib-cache'), 'fotoServivel mira o cache do thumb');
  assert.ok(catalog.includes('filter((r) => fotoServivel(r.photoLp))'), 'listRecent descarta sem arquivo servível');
  assert.ok(facets.includes('fotoServivel(r.photoLp)'), 'facets descarta/capa sem arquivo servível');
});
