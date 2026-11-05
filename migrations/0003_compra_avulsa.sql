-- 3DE créditos avulsos (C3, Marcus 04/11/26): pacote Medusa pago vira saldo no ledger.
-- reason='compra_avulsa', order_ref = id do pedido Medusa.
-- Idempotência: retry/webhook duplo com o mesmo pedido não credita 2x (parcial cobre
-- só linhas de compra; grant/download seguem nas regras de 0002).
ALTER TABLE credits_ledger ADD COLUMN order_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_compra ON credits_ledger(user_id, order_ref) WHERE order_ref IS NOT NULL;
