// D1 de CONTAS do 3DE (users/ledger/downloads) — banco próprio, separado do catálogo.
if (import.meta.env.SSR === false) throw new Error('acctdb.ts e server-only (token).');
const ACCT = import.meta.env.D1_ACCOUNT_ID ?? '';
const DB = import.meta.env.ACCT_D1_DATABASE_ID ?? '';
const TOKEN = import.meta.env.D1_API_TOKEN ?? '';
export interface D1Row {[k: string]: unknown;}
export async function acctQuery(sqlText: string, params: unknown[] = []): Promise<D1Row[]> {
  if (!ACCT || !DB || !TOKEN) throw new Error('D1 de contas não configurado (D1_ACCOUNT_ID/ACCT_D1_DATABASE_ID/D1_API_TOKEN).');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DB}/query`, {method: 'POST',headers: {Authorization: 'Bearer ' + TOKEN,'Content-Type': 'application/json'},body: JSON.stringify({sql: sqlText,params})});
  if (!r.ok) throw new Error(`D1 contas HTTP ${r.status} (sem corpo util).`);
  const j = (await r.json()) as {success: boolean;result?: Array<{results?: D1Row[]}>;errors?: unknown;};
  if (!j.success) throw new Error('D1 contas query falhou: ' + JSON.stringify(j.errors).slice(0, 200));
  return j.result?.[0]?.results ?? [];
}
