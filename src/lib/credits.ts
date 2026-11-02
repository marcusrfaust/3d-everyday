// Carteira de créditos: saldo, preço, débito, virada mensal.
import { acctQuery } from './acctdb';
import { d1query } from './d1';
import { getPlan, grantFor, priceRule } from './plans';
export async function balanceOf(userId: number): Promise<number> {
  const rows = await acctQuery(`SELECT COALESCE(SUM(delta),0) AS s FROM credits_ledger WHERE user_id = ?`, [userId]);
  return Number(rows[0]?.s ?? 0);
}
export async function priceForItem(itemId: number): Promise<number> {
  const over = await acctQuery(`SELECT price FROM item_prices WHERE item_id = ? LIMIT 1`, [itemId]);
  if (over.length) return Number(over[0].price);
  const rows = await d1query(`SELECT COALESCE(SUM(size_bytes),0) AS t FROM files WHERE item_id = ? AND kind = 'document'`, [itemId]);
  return priceRule(Number(rows[0]?.t ?? 0));
}
export async function alreadyDownloaded(userId: number, itemId: number): Promise<boolean> {
  const rows = await acctQuery(`SELECT 1 AS x FROM downloads WHERE user_id = ? AND item_id = ? LIMIT 1`, [userId, itemId]);
  return rows.length > 0;
}
export interface DebitResult {ok: boolean;price: number;saldo: number;motivo?: string;}
// Debita o preço; Studio não paga re-download.
// Anti-duplo-débito (RedTeam 3DE): reserva primeiro em downloads com (user,item,mês).
// Duplo-clique no mesmo mês cai na reserva e não cobra 2x; novo mês cobra de novo
// (exceto Studio com redownloadGratis, que nunca re-paga).
export async function debitDownload(userId: number, planSlug: string, itemId: number, month: string): Promise<DebitResult> {
  const plan = getPlan(planSlug);
  const price = await priceForItem(itemId);
  if (plan.redownloadGratis && (await alreadyDownloaded(userId, itemId))) {
    return {ok: true, price: 0, saldo: await balanceOf(userId)};
  }
  const held = await acctQuery(`INSERT OR IGNORE INTO downloads (user_id, item_id, price, monthly_key) VALUES (?,?,?,?) RETURNING 1 AS held`, [userId, itemId, price, month]);
  if (!held.length && !plan.redownloadGratis) {
    return {ok: true, price: 0, saldo: await balanceOf(userId)};
  }
  const saldo = await balanceOf(userId);
  if (saldo < price) {
    await acctQuery(`DELETE FROM downloads WHERE user_id = ? AND item_id = ? AND monthly_key = ?`, [userId, itemId, month]);
    return {ok: false, price, saldo, motivo: 'sem_saldo'};
  }
  // inserts both or neither from the caller's view: ledger row carries the same
  // (user,month,download,item) key as the UNIQUE — retry after crash hits the
  // UNIQUE instead of double-charging (RedTeam 3DE: 2 INSERTs sem transação).
  await acctQuery(`INSERT OR IGNORE INTO credits_ledger (user_id, month, delta, reason, item_id) VALUES (?,?,?,?,?)`, [userId, month, -price, 'download', itemId]);
  return {ok: true, price, saldo: saldo - price};
}
// Virada mensal: credita conforme o plano (respeita teto/expiração). Idempotente por mês? Não:
// registra 'grant' uma vez por (user, month) — segunda chamada no mesmo mês não credita de novo.
export async function grantMonthly(userId: number, planSlug: string, month: string): Promise<number> {
  const plan = getPlan(planSlug);
  const grant = grantFor(plan, await balanceOf(userId));
  if (grant <= 0) return 0;
  // UNIQUE(user,month,grant,NULL) faz a idempotência: retry não credita 2x (RedTeam 3DE).
  const rows = await acctQuery(`INSERT OR IGNORE INTO credits_ledger (user_id, month, delta, reason) VALUES (?,?,?,?) RETURNING 1 AS ok`, [userId, month, grant, 'grant']);
  return rows.length ? grant : 0;
}
export async function extrato(userId: number, limit = 30) {
  const n = Math.min(Math.max(1, Math.floor(limit) || 30), 100);
  return acctQuery(`SELECT month, delta, reason, item_id, created_at FROM credits_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?`, [userId, n]);
}
