// Aplica migrations/*.sql no D1 de contas — 1x cada (tracker _migrations).
// Uso: D1_ACCOUNT_ID=... ACCT_D1_DATABASE_ID=... D1_API_TOKEN=... node scripts/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const acct = process.env.D1_ACCOUNT_ID;
const db = process.env.ACCT_D1_DATABASE_ID;
const tok = process.env.D1_API_TOKEN;
if (!acct || !db || !tok) { console.error('faltam D1_ACCOUNT_ID/ACCT_D1_DATABASE_ID/D1_API_TOKEN'); process.exit(1); }
async function q(sql, params = []) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/d1/database/${db}/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  });
  const j = await r.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors).slice(0, 500));
  return j.result?.[0]?.results ?? [];
}
await q(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
const done = new Set((await q(`SELECT name FROM _migrations`)).map((r) => String(r.name)));
// 0001 foi aplicada antes do tracker: registra sem reaplicar (tabelas usam IF NOT EXISTS de todo modo,
// mas ALTERs futuros não são re-executáveis — por isso o tracker existe).
for (const f of readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(f)) { console.log(`MIGRATE ${f} já aplicada — pulo`); continue; }
  if (f === '0001_contas.sql') { await q(`INSERT OR IGNORE INTO _migrations (name) VALUES (?)`, [f]); console.log(`MIGRATE ${f} registrada (pré-tracker)`); continue; }
  await q(readFileSync(join(root, 'migrations', f), 'utf8'));
  await q(`INSERT INTO _migrations (name) VALUES (?)`, [f]);
  console.log(`MIGRATE ${f} OK`);
}
