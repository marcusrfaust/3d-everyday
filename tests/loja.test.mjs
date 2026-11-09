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

test('detalhe STL: ramo sem cart fiat, com link /modelo (Marcus 06/11/26)', () => {
  const detalhe = readFileSync(path.join(root, 'src/pages/loja/[handle].astro'), 'utf8');
  assert.ok(detalhe.includes('getProduct'), 'detalhe Medusa intacto');
  assert.ok(detalhe.includes('isStlProduct'), 'detalhe distingue produto STL');
  assert.ok(detalhe.includes('/modelo/${stl!.itemId}') || detalhe.includes('/modelo/'), 'STL leva à peça (aquisição via carteira)');
  assert.ok(detalhe.includes('adquirir com créditos'), 'CTA de créditos no ramo STL');
});

test('cart/update remove linha STL e checkout recusa carrinho com STL (fail-closed)', () => {
  const action = readFileSync(path.join(root, 'src/pages/api/cart/[action].ts'), 'utf8');
  assert.ok(action.includes('stlLines'), 'checkout varre linhas STL do carrinho');
  assert.ok(action.includes('erro=stl'), 'checkout com STL volta sem completar');
  assert.ok(action.includes('/modelo/${itemId}'), 'update com STL remove a linha e leva à peça');
});

test('cart/add bloqueia variante STL (guard anti-bypass)', () => {
  const action = readFileSync(path.join(root, 'src/pages/api/cart/[action].ts'), 'utf8');
  assert.ok(action.includes('stlVariantMap'), 'add consulta o mapa de variantes STL');
  assert.ok(action.includes('/modelo/${itemId}'), 'variante STL redireciona para a peça');
});

test('créditos avulsos: grade só de pacotes (C3), detalhe com ramos pacote/demo', () => {
  const cred = readFileSync(path.join(root, 'src/pages/loja/creditos.astro'), 'utf8');
  assert.ok(cred.includes('listCreditPacks'), 'grade usa listCreditPacks');
  assert.ok(!cred.includes('Modelo') && !cred.includes('/modelo/'), 'grade de pacotes não mistura peças');
  assert.ok(cred.includes('créditos'), 'pacote anuncia créditos');
  const detalhe = readFileSync(path.join(root, 'src/pages/loja/[handle].astro'), 'utf8');
  assert.ok(detalhe.includes('creditPackOf'), 'detalhe distingue pacote de demo');
  assert.ok(detalhe.includes('demonstração'), 'demo fora do catálogo é sinalizado honestamente');
  assert.ok(detalhe.includes('/loja/creditos'), 'breadcrumb leva a créditos');
});

test('creditPurchase: idempotente por pedido, valida entradas (C3)', () => {
  const c = readFileSync(path.join(root, 'src/lib/credits.ts'), 'utf8');
  assert.ok(c.includes('creditPurchase'), 'credits.ts exporta creditPurchase');
  assert.ok(c.includes('compra_avulsa'), 'reason próprio, sem colidir com grant/download');
  assert.ok(c.includes('INSERT OR IGNORE'), 'idempotente (retry não credita 2x)');
  assert.ok(c.includes('order_ref'), 'amarrado ao pedido Medusa');
  const m = readFileSync(path.join(root, 'migrations/0003_compra_avulsa.sql'), 'utf8');
  assert.ok(m.includes('idx_ledger_compra'), 'UNIQUE parcial garante 1 crédito por pedido');
  assert.ok(m.includes('IF NOT EXISTS') || m.includes('IF NOT EXIST'), 'migration aditiva e segura');
});
