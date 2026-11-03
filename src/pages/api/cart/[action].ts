// Carrinho 3DE↔Medusa: cookie httpOnly medusa_cart guarda o cart_id;
// cookie medusa_region guarda a moeda escolhida (usd/eur/brl).
// POST /api/cart/add | /update | /checkout | /currency (Astro SSR, server-side, chave nunca vaza).
import type { APIRoute } from 'astro';
import { createCart, getCart, addLine, updateLine, completeCart, resolveRegionId, normalizeCurrency, REGION_COOKIE } from '../../../lib/medusa';
export const prerender = false;
const COOKIE = 'medusa_cart';
const REGION_MAX_AGE = 60 * 60 * 24 * 365;
function regionOpts() { return { path: '/', maxAge: REGION_MAX_AGE, sameSite: 'lax' as const }; }
function safeNext(v: unknown): string {
  const s = String(v ?? '');
  return s.startsWith('/') && !s.startsWith('//') ? s : '/loja/carrinho';
}
async function cartIdFrom(cookies: any): Promise<string | null> {
  const id = cookies.get(COOKIE)?.value;
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
    const cart = await createCart(await resolveRegionId(cur)); // trocar moeda recria o cart
    cookies.set(COOKIE, cart.id, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
    cookies.set(REGION_COOKIE, cur, regionOpts());
    return redirect(safeNext(next));
  }
  if (action === 'add') {
    const form = await request.formData();
    const variantId = String(form.get('variantId') ?? '');
    const qty = Math.max(1, Math.min(99, Number(form.get('qty') ?? 1) || 1));
    if (!variantId) return redirect('/loja');
    const wantCur = normalizeCurrency(cookies.get(REGION_COOKIE)?.value);
    let id = await cartIdFrom(cookies);
    if (id && wantCur) {
      const cur = await getCart(id).catch(() => null); // cart de outra moeda → recria na moeda escolhida
      if (cur && cur.currency_code !== wantCur) id = null;
    }
    if (!id) {
      const cart = await createCart(await resolveRegionId(wantCur ?? undefined));
      id = cart.id;
      if (wantCur) cookies.set(REGION_COOKIE, wantCur, regionOpts());
    }
    await addLine(id, variantId, qty);
    cookies.set(COOKIE, id, { httpOnly: true, path: '/', maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' });
    return redirect('/loja/carrinho');
  }
  if (action === 'update') {
    const form = await request.formData();
    const lineId = String(form.get('lineId') ?? '');
    const qty = Math.max(0, Math.min(99, Number(form.get('qty') ?? 0) || 0));
    const id = await cartIdFrom(cookies);
    if (id && lineId) await updateLine(id, lineId, qty);
    return redirect('/loja/carrinho');
  }
  if (action === 'checkout') {
    const id = await cartIdFrom(cookies);
    if (!id) return redirect('/loja/carrinho');
    try {
      await completeCart(id);
      cookies.delete(COOKIE, { path: '/' });
      return redirect('/loja/carrinho?checkout=ok');
    } catch (e) {
      return redirect(`/loja/carrinho?erro=${encodeURIComponent(e instanceof Error ? e.message : 'erro')}`);
    }
  }
  return new Response('ação inválida', { status: 404 });
};
