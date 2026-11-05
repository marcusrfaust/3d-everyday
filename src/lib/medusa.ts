// Cliente server-side da Store API do MedusaJS (backend ecommerce 3DE).
// MEDUSA_URL + MEDUSA_PUBLISHABLE_KEY vêm do .env — nunca commitar valores.
// Nenhuma leitura de env no top-level: seguro p/ bundle de teste (node --test).
export interface StorePrice { amount: number; currency_code: string; }
export interface StoreVariant { id: string; title: string | null; prices?: StorePrice[]; }
export interface StoreProduct { id: string; title: string; handle: string; thumbnail: string | null; metadata?: Record<string, unknown> | null; variants?: StoreVariant[]; }
export interface CartLine { id: string; title: string; variant_id?: string; quantity: number; unit_price: number; thumbnail?: string | null; }
export interface StoreCart { id: string; region_id?: string; currency_code: string; items: CartLine[]; total: number; }
function base(): string { return (import.meta.env.MEDUSA_URL ?? 'http://127.0.0.1:9000').replace(/\/+$/, ''); }
function pubkey(): string { return import.meta.env.MEDUSA_PUBLISHABLE_KEY ?? ''; }
async function store(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(base() + path, {
    ...init,
    headers: { 'x-publishable-api-key': pubkey(), 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String((data as any).message ?? (data as any).type ?? `medusa ${res.status}`));
  return data;
}
export async function listRegions(): Promise<Array<{ id: string; currency_code: string }>> {
  const d = await store('/store/regions');
  return (d.regions ?? []).map((r: any) => ({ id: String(r.id), currency_code: String(r.currency_code ?? '').toLowerCase() }));
}
// ---- Moeda/região (loja global USD/EUR/BRL) ----
// Nenhuma preferência hardcoded por moeda: o padrão vem do backend (1ª região
// de listRegions) ou do carrinho; aqui só validamos a escolha (?currency=/cookie).
export const SUPPORTED_CURRENCIES = ['usd', 'eur', 'brl'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
// Cookie que persiste a moeda escolhida no seletor (valor = currency_code).
export const REGION_COOKIE = 'medusa_region';
// Último recurso p/ payload sem currency (dado corrompido): em fluxo normal a
// moeda sempre vem da região (?currency=/cookie) ou do carrinho.
const LAST_RESORT_CURRENCY = 'usd';
export function normalizeCurrency(v: unknown): SupportedCurrency | null {
  const c = String(v ?? '').trim().toLowerCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(c) ? (c as SupportedCurrency) : null;
}
// ?currency= vence o cookie; fallback = moeda da região/carrinho atual.
export function resolveRequestCurrency(query: unknown, cookie: unknown, fallback?: unknown): string {
  return normalizeCurrency(query) ?? normalizeCurrency(cookie) ?? normalizeCurrency(fallback) ?? LAST_RESORT_CURRENCY;
}
export function localeForCurrency(currency: string): string {
  switch (String(currency ?? '').toLowerCase()) {
    case 'brl': return 'pt-BR';
    case 'usd': return 'en-US';
    default: return 'en-IE'; // EUR (e demais): símbolo € com formato en
  }
}
// Região da moeda escolhida (listRegions); sem moeda ou sem região nessa
// moeda → 1ª região (padrão definido no backend Medusa, não hardcoded).
export async function resolveRegionId(currency?: unknown): Promise<string> {
  const regions = await listRegions();
  if (!regions.length) throw new Error('medusa sem regiões');
  const want = normalizeCurrency(currency);
  if (want) {
    const hit = regions.find((r) => r.currency_code === want);
    if (hit) return hit.id;
  }
  return regions[0].id;
}
export async function listProducts(limit = 24): Promise<StoreProduct[]> {
  const d = await store(`/store/products?limit=${Math.min(limit, 100)}&fields=id,title,handle,thumbnail,metadata,*variants.prices`);
  return (d.products ?? []).map((p: any) => ({
    id: String(p.id), title: String(p.title ?? 'Produto sem título'), handle: String(p.handle ?? p.id),
    thumbnail: p.thumbnail == null ? null : String(p.thumbnail),
    metadata: (p.metadata != null && typeof p.metadata === 'object' ? p.metadata as Record<string, unknown> : null),
    variants: (p.variants ?? []).map((v: any) => ({ id: String(v.id), title: v.title == null ? null : String(v.title), prices: (v.prices ?? []).map((x: any) => ({ amount: Number(x.amount ?? 0), currency_code: String(x.currency_code ?? '').toLowerCase() })) })),
  }));
}
export async function getProduct(handle: string): Promise<StoreProduct | null> {
  // Lookup direto (sem N+1): 1 round-trip. metadata vem junto (C3: pacote = credits).
  const d = await store(`/store/products?handle=${encodeURIComponent(handle)}&fields=id,title,handle,thumbnail,metadata,description,*variants.prices`);
  const p = (d.products ?? [])[0];
  if (!p) return null;
  return {
    id: String(p.id), title: String(p.title ?? ''), handle: String(p.handle ?? handle),
    thumbnail: p.thumbnail == null ? null : String(p.thumbnail),
    metadata: (p.metadata != null && typeof p.metadata === 'object' ? p.metadata as Record<string, unknown> : null),
    variants: (p.variants ?? []).map((v: any) => ({ id: String(v.id), title: v.title == null ? null : String(v.title), prices: (v.prices ?? []).map((x: any) => ({ amount: Number(x.amount ?? 0), currency_code: String(x.currency_code ?? '').toLowerCase() })) })),
  };
}

// ---- Créditos avulsos (C3/C4, decisão Marcus 04/11/26) ----
// Peça (STL/3MF) custa créditos; dinheiro só compra PACOTE de créditos no Medusa.
// Pacote = produto Medusa com metadata.credits = quantidade (inteiro > 0).
// Sem metadata.credits válido, não é pacote (nunca deduzir do título).
export function creditPackOf(p: StoreProduct): number | null {
  const raw = p.metadata?.credits;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}
// Só pacotes entram na grade de créditos avulsos (demo/merch sem metadata fica fora).
export async function listCreditPacks(limit = 24): Promise<Array<{ pack: StoreProduct; credits: number }>> {
  const all = await listProducts(Math.min(Math.max(1, limit * 2), 100));
  const packs: Array<{ pack: StoreProduct; credits: number }> = [];
  for (const p of all) {
    const c = creditPackOf(p);
    if (c != null) packs.push({ pack: p, credits: c });
    if (packs.length >= limit) break;
  }
  return packs;
}
export async function createCart(regionId: string): Promise<StoreCart> {
  const d = await store('/store/carts', { method: 'POST', body: JSON.stringify({ region_id: regionId }) });
  return normalizeCart(d.cart);
}
export async function getCart(cartId: string): Promise<StoreCart | null> {
  try { const d = await store(`/store/carts/${cartId}?fields=id,region_id,currency_code,total,*items`); return normalizeCart(d.cart); }
  catch { return null; }
}
export async function addLine(cartId: string, variantId: string, quantity: number): Promise<StoreCart> {
  const d = await store(`/store/carts/${cartId}/line-items`, { method: 'POST', body: JSON.stringify({ variant_id: variantId, quantity }) });
  return normalizeCart(d.cart);
}
export async function updateLine(cartId: string, lineId: string, quantity: number): Promise<StoreCart> {
  const d = quantity <= 0
    ? await store(`/store/carts/${cartId}/line-items/${lineId}`, { method: 'DELETE' })
    : await store(`/store/carts/${cartId}/line-items/${lineId}`, { method: 'POST', body: JSON.stringify({ quantity }) });
  // DELETE do Medusa retorna {deleted:true, parent:{cart…}} sem .cart.
  return normalizeCart((d as any).cart ?? (d as any).parent ?? d);
}
export async function completeCart(cartId: string): Promise<{ type: string; orderId?: string }> {
  const d = await store(`/store/carts/${cartId}/complete`, { method: 'POST' });
  if (d.order) return { type: 'order', orderId: String(d.order.id ?? '') };
  return { type: String(d.type ?? 'cart') };
}
function normalizeCart(c: any): StoreCart {
  return {
    id: String(c.id), region_id: c.region_id == null ? undefined : String(c.region_id),
    currency_code: String(c.currency_code ?? '').toLowerCase() || LAST_RESORT_CURRENCY,
    items: (c.items ?? []).map((i: any) => ({
      id: String(i.id), title: String(i.title ?? i.product_title ?? 'Item'), variant_id: i.variant_id == null ? undefined : String(i.variant_id),
      quantity: Number(i.quantity ?? 1), unit_price: Number(i.unit_price ?? 0),
      thumbnail: i.thumbnail == null ? null : String(i.thumbnail),
    })),
    total: Number(c.total ?? 0),
  };
}
// ---- Puras (cobertas por tests/medusa.test.mjs) ----
// Sem preferência hardcoded: com moeda → melhor preço nela; sem moeda (ou sem
// preço nela) → 1º preço disponível (ordem do backend). Null só sem preço.
export function productPrice(p: StoreProduct, currency?: unknown): StorePrice | null {
  return priceInCurrency(p, currency).price;
}
// Variante com flag de fallback: exact=false quando exibimos preço de outra
// moeda por falta de preço na moeda escolhida (UI deve avisar).
export function priceInCurrency(p: StoreProduct, currency?: unknown): { price: StorePrice | null; exact: boolean } {
  const want = normalizeCurrency(currency);
  if (want) {
    for (const v of p.variants ?? []) { const hit = (v.prices ?? []).find((x) => x.currency_code === want); if (hit) return { price: hit, exact: true }; }
    for (const v of p.variants ?? []) { if ((v.prices ?? []).length) return { price: (v.prices as StorePrice[])[0], exact: false }; }
    return { price: null, exact: false };
  }
  for (const v of p.variants ?? []) { if ((v.prices ?? []).length) return { price: (v.prices as StorePrice[])[0], exact: true }; }
  return { price: null, exact: false };
}
export function formatMoney(amountMinor: number, currency: string): string {
  const code = String(currency ?? '').toUpperCase() || 'USD';
  try { return new Intl.NumberFormat(localeForCurrency(code), { style: 'currency', currency: code }).format(amountMinor / 100); }
  catch { return `${(amountMinor / 100).toFixed(2)} ${code}`; }
}
export function cartCount(cart: StoreCart): number { return cart.items.reduce((n, i) => n + i.quantity, 0); }
