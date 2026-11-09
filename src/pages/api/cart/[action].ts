// Carrinho 3DE↔Medusa: cookie httpOnly medusa_cart guarda o cart_id;
// cookie medusa_region guarda a moeda escolhida (usd/eur/brl).
// POST /api/cart/add | /update | /checkout | /currency (Astro SSR, server-side, chave nunca vaza).
import type { APIRoute } from 'astro';
import { createCart, getCart, addLine, updateLine, completeCart, resolveRegionId, normalizeCurrency, stlVariantMap, REGION_COOKIE } from '../../../lib/medusa';
export const prerender = false;
const COOKIE = 'medusa_cart';
const REGION_MAX_AGE = 60 * 60 * 24 * 365;
const CART_MAX_AGE = 60 * 60 * 24 * 7;
function secureFlag(request: Request): boolean {
  if (import.meta.env.PROD) return true;
  const proto = request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol;
  return proto === 'https:';
}
function cartOpts(request: Request) { return { httpOnly: true as const, path: '/', maxAge: CART_MAX_AGE, sameSite: 'lax' as const, secure: secureFlag(request) }; }
function regionOpts(request: Request) { return { httpOnly: true as const, path: '/', maxAge: REGION_MAX_AGE, sameSite: 'lax' as const, secure: secureFlag(request) }; }
// IDs opacos do Medusa (cart_*, variant_*, item_*): só alfanumérico + _/-, sem / . query.
function safeId(v: unknown): string | null {
  const s = String(v ?? '');
  return /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : null;
}
function safeNext(v: unknown): string {
  const s = String(v ?? '');
  if (!s.startsWith('/') || s.startsWith('//')) return '/loja/carrinho';
  if (s.includes('\\') || /%5c/i.test(s)) return '/loja/carrinho';
  if (!/^\/[A-Za-z0-9/_.\-]*(\?[A-Za-z0-9=&_.\-]*)?$/.test(s)) return '/loja/carrinho';
  return s;
}
async function cartIdFrom(cookies: any): Promise<string | null> {
  const id = safeId(cookies.get(COOKIE)?.value);
  if (id && (await getCart(id).catch(() => null))) return id;
  return null;
}
export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const action = params.action;
  if (action === 'currency') {
    const url = new URL(request.url);
    let want: unknown = url.searchParams.get('currency');
    let next: unknown = url.searchParams.get('next');
    try {
      const form = await request.formData();
      want = form.get('currency') ?? want;
      next = form.get('next') ?? next;
    } catch { /* GET/POST sem body: usa query */ }
    const cur = normalizeCurrency(want);
    if (!cur) return redirect(safeNext(next));
    try {
      const cart = await createCart(await resolveRegionId(cur)); // trocar moeda recria o cart
      cookies.set(COOKIE, cart.id, cartOpts(request));
      cookies.set(REGION_COOKIE, cur, regionOpts(request));
    } catch {
      return redirect('/loja/carrinho?erro=checkout');
    }
    return redirect(safeNext(next));
  }
  if (action === 'add') {
    let form: FormData;
    try { form = await request.formData(); } catch { return redirect('/loja'); }
    const variantId = safeId(form.get('variantId'));
    const qty = Math.max(1, Math.min(99, Number(form.get('qty') ?? 1) || 1));
    if (!variantId) return redirect('/loja');
    // STL adquire-se via carteira, nunca via cart fiat (guard anti-bypass:
    // POST manual com variantId não passa — redireciona p/ a peça).
    try {
      const stlMap = await stlVariantMap();
      const itemId = stlMap.get(variantId);
      if (itemId != null) return redirect(`/modelo/${itemId}`);
    } catch { /* Medusa fora: segue fluxo normal, addLine falha sozinho */ }
    try {
      const wantCur = normalizeCurrency(cookies.get(REGION_COOKIE)?.value);
      let id = await cartIdFrom(cookies);
      if (id && wantCur) {
        const cur = await getCart(id).catch(() => null); // cart de outra moeda → recria na moeda escolhida
        if (cur && cur.currency_code !== wantCur) id = null;
      }
      if (!id) {
        const cart = await createCart(await resolveRegionId(wantCur ?? undefined));
        id = cart.id;
        if (wantCur) cookies.set(REGION_COOKIE, wantCur, regionOpts(request));
      }
      await addLine(id, variantId, qty);
      cookies.set(COOKIE, id, cartOpts(request));
      return redirect('/loja/carrinho');
    } catch {
      return redirect('/loja/carrinho?erro=checkout');
    }
  }
  if (action === 'update') {
    let form: FormData;
    try { form = await request.formData(); } catch { return redirect('/loja/carrinho'); }
    const lineId = safeId(form.get('lineId'));
    const qty = Math.max(0, Math.min(99, Number(form.get('qty') ?? 0) || 0));
    const id = await cartIdFrom(cookies);
    if (id && lineId) {
      try { await updateLine(id, lineId, qty); } catch { return redirect('/loja/carrinho?erro=checkout'); }
    }
    return redirect('/loja/carrinho');
  }
  if (action === 'checkout') {
    const id = await cartIdFrom(cookies);
    if (!id) return redirect('/loja/carrinho');
    try {
      await completeCart(id);
      cookies.delete(COOKIE, { path: '/' });
      return redirect('/loja/carrinho?checkout=ok');
    } catch {
      return redirect('/loja/carrinho?erro=checkout');
    }
  }
  return new Response('ação inválida', { status: 404 });
};
