// Loja oficial = catálogo STL/3MF com preço em créditos (decisão Marcus 04/11/26).
// Sem produto demo anunciado; nada é apagado do Medusa (só não entra na grade).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const loja = readFileSync(path.join(root, 'src/pages/loja/index.astro'), 'utf8');

test('loja lê o catálogo real (searchItems), não o merch demo', () => {
  assert.ok(loja.includes('searchItems'), 'loja usa searchItems do catálogo');
  assert.ok(!loja.includes('listProducts'), 'loja não lista produtos Medusa demo na grade');
  assert.ok(!loja.includes('formatMoney'), 'loja não exibe dinheiro');
  assert.ok(!loja.includes('CurrencySelector'), 'crédito não tem moeda');
});

test('loja anuncia preço em créditos e leva ao modelo', () => {
  assert.ok(loja.includes('créditos'), 'preço em créditos');
  assert.ok(loja.includes('ModelCard'), 'cards do catálogo com link ao modelo');
  assert.ok(loja.includes('/busca'), 'ver-tudo para o catálogo');
});

test('checkout Medusa preservado nas rotas de detalhe (sem delete)', () => {
  const detalhe = readFileSync(path.join(root, 'src/pages/loja/[handle].astro'), 'utf8');
  assert.ok(detalhe.includes('getProduct'), 'detalhe Medusa intacto');
});
