// Helpers puros de paginação (testados em tests/paginacao.test.mjs).
// Sem acesso a banco: só matemática + montagem de URL.
export const PER_PAGE_PADRAO = 24;
export const PER_PAGE_MAX = 100;

export function clampPerPage(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return PER_PAGE_PADRAO;
  return Math.min(n, PER_PAGE_MAX);
}

export function totalPages(total: number, perPage: number): number {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const p = Math.max(1, Math.floor(Number(perPage) || PER_PAGE_PADRAO));
  return Math.max(1, Math.ceil(t / p));
}

export function clampPage(v: unknown, pages: number): number {
  const n = Math.floor(Number(v));
  const last = Math.max(1, Math.floor(Number(pages) || 1));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, last);
}

export function pageOffset(page: number, perPage: number): number {
  return (Math.max(1, page) - 1) * Math.max(1, perPage);
}

export function normalizePage(v: unknown): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

// Janela de páginas p/ a nav: 1 … atual±radius … última. Fonte única (C2) —
// busca.astro e categoria/[slug].astro usam esta função, nunca loop próprio.
export function pageWindow(pages: number, current: number, radius = 2): number[] {
  const last = Math.max(1, Math.floor(Number(pages) || 1));
  const cur = Math.min(Math.max(1, Math.floor(Number(current) || 1)), last);
  const r = Math.max(0, Math.floor(Number(radius) || 0));
  const win: number[] = [];
  for (let p = 1; p <= last; p++) {
    if (p === 1 || p === last || Math.abs(p - cur) <= r) win.push(p);
  }
  return win;
}

// Monta URL de página preservando filtros. pagina=1 é omitido (canônica).
export function buildPageUrl(path: string, params: Record<string, string>, page: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v != null) q.set(k, v);
  }
  if (page > 1) q.set('pagina', String(page));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
