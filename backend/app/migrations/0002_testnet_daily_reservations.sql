CREATE TABLE IF NOT EXISTS testnet_daily_reservations (
 client_order_id TEXT PRIMARY KEY,
 trade_day TEXT NOT NULL,
 notional TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_testnet_daily_reservations_day
 ON testnet_daily_reservations(trade_day);
