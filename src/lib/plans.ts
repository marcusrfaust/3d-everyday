// Planos 3DE (Marcus, 02/11/26): moeda = créditos, peça tem preço próprio.
// everyday: 300/mês, expira (não acumula).
// maker: 600/mês, acumula até 1800.
// studio: 2000/mês, acumula até 6000 + re-download grátis.
export interface Plan {
  slug: string;
  nome: string;
  mensal: number;
  teto: number;
  acumula: boolean;
  redownloadGratis: boolean;
}
export const PLANS: Record<string, Plan> = {
  everyday: {slug: 'everyday', nome: 'Everyday', mensal: 300, teto: 300, acumula: false, redownloadGratis: false},
  maker: {slug: 'maker', nome: 'Maker', mensal: 600, teto: 1800, acumula: true, redownloadGratis: false},
  studio: {slug: 'studio', nome: 'Studio', mensal: 2000, teto: 6000, acumula: true, redownloadGratis: true},
};
export function getPlan(slug: string): Plan {
  return PLANS[slug] ?? PLANS.everyday;
}
// Quanto creditar na virada do mês, dado o saldo atual. Pura (testada).
export function grantFor(plan: Plan, saldoAtual: number): number {
  if (!plan.acumula) return plan.mensal - Math.max(0, Math.min(saldoAtual, plan.mensal));
  return Math.max(0, Math.min(plan.mensal, plan.teto - saldoAtual));
}
// Regra de preço por tamanho total dos arquivos (bytes). Override manual em item_prices.
// Faixas (Marcus, 02/11/26): 30 / 50 / 300 / 600. Pura (testada).
export function priceRule(totalBytes: number): number {
  const MB = 1024 * 1024;
  if (totalBytes <= 5 * MB) return 30;
  if (totalBytes <= 20 * MB) return 50;
  if (totalBytes <= 100 * MB) return 300;
  return 600;
}
