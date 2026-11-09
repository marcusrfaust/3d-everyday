// Rótulos PT-BR para categorias (auditoria visual 08/11/26, G2).
// O slug (EN, vindo do D1/taxonomia) NUNCA muda — só o texto exibido.
// Fonte fora do D1 porque é apresentação, não dado.
const ROTULOS: Record<string, string> = {
  'collectibles': 'Colecionáveis',
  'keychains': 'Chaveiros',
  'miniatures': 'Miniaturas',
  'toys-games': 'Brinquedos e jogos',
  'home-decor': 'Decoração',
  'household': 'Utilidades domésticas',
  'fashion': 'Moda',
  'hobby-diy': 'Hobby e DIY',
  'print-guides': 'Guias de impressão',
  'adults-only': 'Adulto +18',
};
export function rotuloCategoria(slug: unknown, name: unknown): string {
  const s = String(slug ?? '').toLowerCase();
  if (s && ROTULOS[s]) return ROTULOS[s];
  const n = String(name ?? s ?? '').trim();
  return n || 'Categoria';
}
