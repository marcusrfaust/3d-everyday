// Teste lógica pura do client Medusa (sem rede, salvo stubs de fetch).
// Roda: npm test. Gerado por `npm run build:test` (esbuild de src/lib/medusa.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, productPrice, priceInCurrency, cartCount, creditPackOf, isStlProduct, stlItemId, stlCreditsPrice, normalizeCurrency, resolveRequestCurrency, localeForCurrency, resolveRegionId } from './_medusa.mjs';

test('normalizeCurrency aceita USD/EUR/BRL (case/trim) e rejeita resto', () => {
  assert.equal(normalizeCurrency('USD'), 'usd');
  assert.equal(normalizeCurrency(' eur '), 'eur');
  assert.equal(normalizeCurrency('Brl'), 'brl');
  assert.equal(normalizeCurrency('xyz'), null);
  assert.equal(normalizeCurrency(''), null);
  assert.equal(normalizeCurrency(null), null);
  assert.equal(normalizeCurrency(undefined), null);
});

test('resolveRequestCurrency: ?currency= vence cookie; cookie vence fallback; último recurso válido', () => {
  assert.equal(resolveRequestCurrency('eur', 'brl', 'usd'), 'eur'); // query vence
  assert.equal(resolveRequestCurrency('xxx', 'brl', 'usd'), 'brl'); // query inválida → cookie
  assert.equal(resolveRequestCurrency(null, 'usd', 'brl'), 'usd'); // sem query → cookie
  assert.equal(resolveRequestCurrency(null, null, 'brl'), 'brl'); // sem nada → moeda região/carrinho
  assert.ok(['usd', 'eur', 'brl'].includes(resolveRequestCurrency(null, null, 'xxx'))); // fallback inválido → último recurso
});

test('localeForCurrency por moeda', () => {
  assert.equal(localeForCurrency('brl'), 'pt-BR');
  assert.equal(localeForCurrency('usd'), 'en-US');
  assert.equal(localeForCurrency('eur'), 'en-IE');
});

test('formatMoney usa locale por moeda', () => {
  assert.equal(formatMoney(1999, 'brl'), 'R$ 19,99');
  assert.equal(formatMoney(0, 'brl'), 'R$ 0,00');
  assert.ok(formatMoney(1999, 'usd').includes('$19.99'));
  const eur = formatMoney(1999, 'eur');
  assert.ok(eur.includes('19.99') && eur.includes('€'));
});

test('productPrice prefere moeda pedida; sem moeda cai p/ 1º disponível; null sem preço', () => {
  const p = { id: 'x', title: 'T', handle: 't', thumbnail: null, variants: [{ id: 'v1', title: null, prices: [{ amount: 1000, currency_code: 'eur' }, { amount: 5500, currency_code: 'brl' }] }] };
  assert.deepEqual(productPrice(p, 'brl'), { amount: 5500, currency_code: 'brl' });
  assert.deepEqual(productPrice(p, 'usd'), { amount: 1000, currency_code: 'eur' }); // sem USD → 1º disponível
  assert.deepEqual(productPrice(p), { amount: 1000, currency_code: 'eur' }); // sem moeda → 1º (sem preferência)
  assert.deepEqual(productPrice(p, 'xxx'), { amount: 1000, currency_code: 'eur' }); // moeda inválida → 1º
  assert.equal(productPrice({ id: 'y', title: 'Y', handle: 'y', thumbnail: null, variants: [] }), null);
});

test('resolveRegionId escolhe região da moeda; fallback 1ª; erro sem regiões', async () => {
  const realFetch = globalThis.fetch;
  const regions = [{ id: 'reg_us', currency_code: 'usd' }, { id: 'reg_eu', currency_code: 'eur' }, { id: 'reg_br', currency_code: 'brl' }];
  globalThis.fetch = async () => new Response(JSON.stringify({ regions }));
  try {
    assert.equal(await resolveRegionId('eur'), 'reg_eu');
    assert.equal(await resolveRegionId('BRL'), 'reg_br');
    assert.equal(await resolveRegionId('jpy'), 'reg_us'); // moeda sem região → 1ª (padrão backend)
    assert.equal(await resolveRegionId(), 'reg_us'); // sem moeda → 1ª
  } finally {
    globalThis.fetch = realFetch;
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ regions: [] }));
  try {
    await assert.rejects(() => resolveRegionId('usd'), /sem regiões/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('priceInCurrency sinaliza fallback (exact=false)', () => {
  const p = { id: 'x', title: 'T', handle: 't', thumbnail: null, variants: [{ id: 'v1', title: null, prices: [{ amount: 1000, currency_code: 'eur' }] }] };
  assert.deepEqual(priceInCurrency(p, 'eur'), { price: { amount: 1000, currency_code: 'eur' }, exact: true });
  assert.deepEqual(priceInCurrency(p, 'usd'), { price: { amount: 1000, currency_code: 'eur' }, exact: false });
  assert.deepEqual(priceInCurrency(p), { price: { amount: 1000, currency_code: 'eur' }, exact: true });
  assert.deepEqual(priceInCurrency({ id: 'y', title: 'Y', handle: 'y', thumbnail: null, variants: [] }, 'usd'), { price: null, exact: false });
});

test('cartCount soma quantidades', () => {
  assert.equal(cartCount({ id: 'c', currency_code: 'brl', total: 0, items: [{ id: 'a', title: 'A', quantity: 2, unit_price: 100 }, { id: 'b', title: 'B', quantity: 3, unit_price: 50 }] }), 5);
  assert.equal(cartCount({ id: 'c', currency_code: 'usd', total: 0, items: [] }), 0);
});

test('creditPackOf exige kind credit_pack (C3); STL nunca é pacote', () => {
  const base = { id: 'p', title: 'Pacote 500 créditos', handle: 'h', thumbnail: null };
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: 500 } }), 500);
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: '1500' } }), 1500);
  assert.equal(creditPackOf(base), null); // sem metadata → não é pacote
  assert.equal(creditPackOf({ ...base, metadata: null }), null);
  assert.equal(creditPackOf({ ...base, metadata: {} }), null);
  assert.equal(creditPackOf({ ...base, metadata: { credits: 500 } }), null); // sem kind → não é pacote
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'stl', item_id: 1, credits_price: 500, credits: 500 } }), null); // STL ≠ pacote
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: 0 } }), null);
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: -10 } }), null);
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: 2.5 } }), null);
  assert.equal(creditPackOf({ ...base, metadata: { kind: 'credit_pack', credits: 'abc' } }), null);
});

test('STL: isStlProduct/stlItemId/stlCreditsPrice (Marcus 06/11/26)', () => {
  const stl = { id: 'p', title: 'Zenitsu', handle: 'stl-34258', thumbnail: null, metadata: { kind: 'stl', item_id: 34258, credits_price: 600 } };
  assert.equal(isStlProduct(stl), true);
  assert.equal(stlItemId(stl), 34258);
  assert.equal(stlCreditsPrice(stl), 600);
  assert.equal(isStlProduct({ id: 'x', title: 'T', handle: 't', thumbnail: null }), false);
  assert.equal(isStlProduct({ id: 'x', title: 'T', handle: 't', thumbnail: null, metadata: { kind: 'credit_pack', credits: 1 } }), false);
  assert.equal(stlItemId({ id: 'x', title: 'T', handle: 't', thumbnail: null, metadata: { kind: 'stl', item_id: 0, credits_price: 5 } }), null);
  assert.equal(stlItemId({ id: 'x', title: 'T', handle: 't', thumbnail: null, metadata: { kind: 'stl', credits_price: 5 } }), null);
  assert.equal(stlCreditsPrice({ id: 'x', title: 'T', handle: 't', thumbnail: null, metadata: { kind: 'stl', item_id: 1 } }), null);
});
