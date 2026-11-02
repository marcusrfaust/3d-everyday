-- 3DE contas + carteira de créditos. Banco D1 próprio (3d-everyday), nunca o do catálogo.
-- v2 (RedTeam 3DE): idempotência sem transação multi-statement.
-- NOTA: 0001 já aplicada em prod; aqui só ALTER/INDEX (tracker do migrate.mjs garante 1 aplicação).
-- monthly_key = mês do débito: 1 débito por (user, item, mês) — anti-duplo-clique.
ALTER TABLE downloads ADD COLUMN monthly_key TEXT NOT NULL DEFAULT '';
-- Ledger download: 1 linha por (user, mês, download, item) — retry pós-crash não cobra 2x.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_download ON credits_ledger(user_id, month, reason, item_id);
-- Grant mensal: 1 por (user, mês). Parcial pois grant tem item_id NULL
-- (UNIQUE comum trata NULL como distinto e permitiria grant duplo).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_grant ON credits_ledger(user_id, month) WHERE reason = 'grant';
-- 1 débito por (user, item, mês) — anti-duplo-clique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_downloads_month ON downloads(user_id, item_id, monthly_key);
