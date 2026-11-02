// Grupos de tags amigáveis: as tags do acervo têm prefixo de tipo
// (char:, franchise:, style:, format:, feature:) — mesma convenção do 3d-lib.
// Aqui o prefixo vira navegação por grupo (Personagens, Estilos, ...).
export const GROUP_LABELS: Record<string, string> = {
  char: 'Personagens',
  franchise: 'Franquias e universos',
  style: 'Estilos',
  format: 'Formatos',
  feature: 'Características',
};
export interface GroupedTag {full: string;short: string;group: string;label: string;count: number;}
export function groupTag(tag: string, count = 0): GroupedTag {
  const i = tag.indexOf(':');
  const group = i > 0 ? tag.slice(0, i) : 'outros';
  const label = GROUP_LABELS[group] ?? 'Outros';
  const short = (i > 0 ? tag.slice(i + 1) : tag).replace(/[-_]+/g, ' ').trim() || tag;
  return {full: tag, short, group, label, count};
}
export interface TagGroup {key: string;label: string;tags: GroupedTag[];}
export function groupFacets(tags: {slug: string;name: string;count: number}[]): TagGroup[] {
  const order = [...Object.keys(GROUP_LABELS), 'outros'];
  const m = new Map<string, GroupedTag[]>();
  for (const t of tags) {
    const g = groupTag(t.slug, t.count);
    if (!m.has(g.group)) m.set(g.group, []);
    m.get(g.group)!.push(g);
  }
  return order.filter((k) => m.has(k)).map((k) => ({key: k, label: GROUP_LABELS[k] ?? 'Outros', tags: m.get(k)!}));
}
export interface NamedGroup {label: string;tags: {short: string;full: string}[];}
// Agrupa nomes crus de tag p/ a página da peça (sem contagem).
export function groupNames(fullTags: string[]): NamedGroup[] {
  const order = [...Object.keys(GROUP_LABELS), 'outros'];
  const m = new Map<string, {short: string;full: string}[]>();
  const labels = new Map<string, string>();
  for (const full of fullTags) {
    const g = groupTag(full);
    if (!m.has(g.group)) { m.set(g.group, []); labels.set(g.group, g.label); }
    m.get(g.group)!.push({short: g.short, full: g.full});
  }
  return order.filter((k) => m.has(k)).map((k) => ({label: labels.get(k)!, tags: m.get(k)!}));
}
