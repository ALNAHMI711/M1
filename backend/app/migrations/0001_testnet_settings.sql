CREATE TABLE IF NOT EXISTS app_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), environment TEXT NOT NULL CHECK(environment='SPOT_TESTNET'),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 allowed_symbols_json TEXT NOT NULL, allowed_order_types_json TEXT NOT NULL, allowed_sides_json TEXT NOT NULL,
 max_order_notional TEXT NOT NULL, max_daily_notional TEXT NOT NULL,
 credentials_test_passed INTEGER NOT NULL DEFAULT 0 CHECK(credentials_test_passed IN (0,1)),
 manual_approval INTEGER NOT NULL DEFAULT 0 CHECK(manual_approval IN (0,1)),
 updated_by TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS exchange_credentials (
 id INTEGER PRIMARY KEY CHECK(id=1), exchange TEXT NOT NULL CHECK(exchange='BINANCE'),
 environment TEXT NOT NULL CHECK(environment='SPOT_TESTNET'),
 api_key_ciphertext BLOB NOT NULL, api_key_nonce BLOB NOT NULL CHECK(length(api_key_nonce)=12),
 api_secret_ciphertext BLOB NOT NULL, api_secret_nonce BLOB NOT NULL CHECK(length(api_secret_nonce)=12),
 encryption_key_version INTEGER NOT NULL, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO app_settings(id,environment,enabled,allowed_symbols_json,allowed_order_types_json,allowed_sides_json,max_order_notional,max_daily_notional,credentials_test_passed,manual_approval,updated_by,updated_at,version)
VALUES(1,'SPOT_TESTNET',0,'["BTCUSDT","ETHUSDT"]','["LIMIT"]','["BUY"]','20','50',0,0,'system',strftime('%Y-%m-%dT%H:%M:%fZ','now'),1);
