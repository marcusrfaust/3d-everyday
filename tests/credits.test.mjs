// Teste lógica pura de planos/preços (sem D1). Roda: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Gerado por `npm run build:test` (esbuild a partir de src/lib/plans.ts).
import { grantFor, priceRule, getPlan } from './_plans.mjs';
test('everyday expira: sem saldo ganha 300; com saldo reseta p/ 300', () => {
  assert.equal(grantFor(getPlan('everyday'), 0), 300);
  assert.equal(grantFor(getPlan('everyday'), 120), 180);
});
test('maker acumula até o teto', () => {
  assert.equal(grantFor(getPlan('maker'), 0), 600);
  assert.equal(grantFor(getPlan('maker'), 1500), 300);
  assert.equal(grantFor(getPlan('maker'), 1800), 0);
  assert.equal(grantFor(getPlan('maker'), 9999), 0);
});
test('studio acumula até 6000', () => {
  assert.equal(grantFor(getPlan('studio'), 0), 2000);
  assert.equal(grantFor(getPlan('studio'), 5000), 1000);
  assert.equal(grantFor(getPlan('studio'), 6000), 0);
});
test('priceRule faixas 30/50/300/600', () => {
  const MB = 1024 * 1024;
  assert.equal(priceRule(0), 30);
  assert.equal(priceRule(5 * MB), 30);
  assert.equal(priceRule(6 * MB), 50);
  assert.equal(priceRule(20 * MB), 50);
  assert.equal(priceRule(21 * MB), 300);
  assert.equal(priceRule(100 * MB), 300);
  assert.equal(priceRule(101 * MB), 600);
});
test('plano desconhecido cai p/ everyday', () => {
  assert.equal(getPlan('xpto').slug, 'everyday');
});
