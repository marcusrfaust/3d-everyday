// Aplica migrations/*.sql no D1 de contas. Uso: ACCT_D1_DATABASE_ID=... D1_ACCOUNT_ID=... D1_API_TOKEN=... node scripts/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const acct = process.env.D1_ACCOUNT_ID;
const db = process.env.ACCT_D1_DATABASE_ID;
const tok = process.env.D1_API_TOKEN;
if (!acct || !db || !tok) { console.error('faltam D1_ACCOUNT_ID/ACCT_D1_DATABASE_ID/D1_API_TOKEN'); process.exit(1); }
const files = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = readFileSync(join(root, 'migrations', f), 'utf8');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acct}/d1/database/${db}/query`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params: [] }),
  });
  const j = await r.json();
  if (!j.success) { console.error(`MIGRATE ${f} FALHOU:`, JSON.stringify(j.errors).slice(0, 500)); process.exit(1); }
  console.log(`MIGRATE ${f} OK`);
}
