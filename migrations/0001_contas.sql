-- 3DE contas + carteira de créditos. Banco D1 próprio (3d-everyday), nunca o do catálogo.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'everyday',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Ledger append-only: saldo = SUM(delta) por usuário. Nunca UPDATE/DELETE.
CREATE TABLE IF NOT EXISTS credits_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  month TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  item_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON credits_ledger(user_id);
-- Downloads registrados: garante re-download grátis do Studio (UNIQUE) e auditoria.
CREATE TABLE IF NOT EXISTS downloads (
  user_id INTEGER NOT NULL REFERENCES users(id),
  item_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, item_id)
);
-- Override manual de preço por peça (fonte: Marcus). Sem linha = regra por tamanho.
CREATE TABLE IF NOT EXISTS item_prices (
  item_id INTEGER PRIMARY KEY,
  price INTEGER NOT NULL
);
