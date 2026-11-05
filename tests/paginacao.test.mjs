// Paginação da busca/categoria (Marcus 04/11/26). Roda: npm test (via build:test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PER_PAGE_PADRAO, clampPage, clampPerPage, normalizePage, totalPages, pageOffset, pageWindow, buildPageUrl } from './_pagination.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('totalPages cerca para cima, mínimo 1', () => {
  assert.equal(totalPages(0, 24), 1);
  assert.equal(totalPages(24, 24), 1);
  assert.equal(totalPages(25, 24), 2);
  assert.equal(totalPages(100, 24), 5);
});

test('clampPage limita a [1, pages], inválido vira 1', () => {
  assert.equal(clampPage(1, 5), 1);
  assert.equal(clampPage(99, 5), 5);
  assert.equal(clampPage(0, 5), 1);
  assert.equal(clampPage(-3, 5), 1);
  assert.equal(clampPage('abc', 5), 1);
  assert.equal(clampPage(2, 0), 1);
});

test('clampPerPage usa padrão quando inválido e respeita teto', () => {
  assert.equal(clampPerPage('x'), PER_PAGE_PADRAO);
  assert.equal(clampPerPage(0), PER_PAGE_PADRAO);
  assert.ok(clampPerPage(1000) <= 100);
});

test('pageOffset: página 1 começa em 0', () => {
  assert.equal(pageOffset(1, 24), 0);
  assert.equal(pageOffset(3, 24), 48);
});

test('normalizePage limita só o piso (>=1); teto é das páginas (C2)', () => {
  assert.equal(normalizePage(3), 3);
  assert.equal(normalizePage(0), 1);
  assert.equal(normalizePage(-5), 1);
  assert.equal(normalizePage('x'), 1);
  assert.equal(normalizePage(999), 999);
});

test('pageWindow: 1 … atual±2 … última (C2, fonte única)', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(5, 1), [1, 2, 3, 5]);
  assert.deepEqual(pageWindow(10, 5), [1, 3, 4, 5, 6, 7, 10]);
  assert.deepEqual(pageWindow(10, 10), [1, 8, 9, 10]);
});

test('busca e categoria usam pageWindow (sem loop próprio)', () => {
  for (const p of ['src/pages/busca.astro', 'src/pages/categoria/[slug].astro']) {
    const s = read(p);
    assert.ok(s.includes('pageWindow'), `${p} usa pageWindow`);
    assert.ok(!s.includes('Math.abs(p - page)'), `${p} sem janela inline`);
  }
});

test('buildPageUrl preserva filtros e omite pagina=1', () => {
  const u1 = buildPageUrl('/busca', {q: 'puma', categoria: '', tag: ''}, 1);
  assert.ok(u1.includes('q=puma') && !u1.includes('pagina'), `canônica sem pagina: ${u1}`);
  const u3 = buildPageUrl('/busca', {q: 'puma', categoria: '', tag: ''}, 3);
  assert.ok(u3.includes('pagina=3') && u3.includes('q=puma'), u3);
});

test('facets: searchItems aceita page/perPage com OFFSET + countItems existe', () => {
  const f = read('src/lib/facets.ts');
  assert.ok(f.includes('countItems'), 'countItems exportado');
  assert.ok(f.includes('OFFSET'), 'searchItems usa OFFSET');
  assert.ok(f.includes('perPage'), 'searchItems aceita perPage');
});

test('busca e categoria renderizam navegação de páginas', () => {
  for (const p of ['src/pages/busca.astro', 'src/pages/categoria/[slug].astro']) {
    const s = read(p);
    assert.ok(s.includes('pagina'), `${p} lê ?pagina=`);
    assert.ok(s.includes('Paginação') || s.includes('aria-label="Paginação"'), `${p} tem nav de paginação`);
    assert.ok(s.includes('aria-current="page"'), `${p} marca página atual`);
    assert.ok(s.includes('rel="prev"') && s.includes('rel="next"'), `${p} tem rel prev/next`);
  }
});
