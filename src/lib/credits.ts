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
// Debita o preço; Studio não paga re-download. Idempotente via UNIQUE.
export async function debitDownload(userId: number, planSlug: string, itemId: number, month: string): Promise<DebitResult> {
  const plan = getPlan(planSlug);
  const price = await priceForItem(itemId);
  if (plan.redownloadGratis && (await alreadyDownloaded(userId, itemId))) {
    return {ok: true, price: 0, saldo: await balanceOf(userId)};
  }
  const saldo = await balanceOf(userId);
  if (saldo < price) return {ok: false, price, saldo, motivo: 'sem_saldo'};
  await acctQuery(`INSERT INTO credits_ledger (user_id, month, delta, reason, item_id) VALUES (?,?,?,?,?)`, [userId, month, -price, 'download', itemId]);
  await acctQuery(`INSERT OR IGNORE INTO downloads (user_id, item_id, price) VALUES (?,?,?)`, [userId, itemId, price]);
  return {ok: true, price, saldo: saldo - price};
}
// Virada mensal: credita conforme o plano (respeita teto/expiração). Idempotente por mês? Não:
// registra 'grant' uma vez por (user, month) — segunda chamada no mesmo mês não credita de novo.
export async function grantMonthly(userId: number, planSlug: string, month: string): Promise<number> {
  const plan = getPlan(planSlug);
  const ja = await acctQuery(`SELECT 1 AS x FROM credits_ledger WHERE user_id = ? AND month = ? AND reason = 'grant' LIMIT 1`, [userId, month]);
  if (ja.length) return 0;
  const grant = grantFor(plan, await balanceOf(userId));
  if (grant > 0) await acctQuery(`INSERT INTO credits_ledger (user_id, month, delta, reason) VALUES (?,?,?,?)`, [userId, month, grant, 'grant']);
  return grant;
}
export async function extrato(userId: number, limit = 30) {
  return acctQuery(`SELECT month, delta, reason, item_id, created_at FROM credits_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?`, [userId, limit]);
}
