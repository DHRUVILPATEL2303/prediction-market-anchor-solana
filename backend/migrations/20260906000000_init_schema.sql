
CREATE TABLE IF NOT EXISTS markets (
    market_pubkey VARCHAR(44) PRIMARY KEY,
    market_id BIGINT NOT NULL,
    authority VARCHAR(44) NOT NULL,
    question TEXT NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    fee_bps SMALLINT NOT NULL,
    outcome VARCHAR(20) DEFAULT 'Unresolved',
    total_yes BIGINT DEFAULT 0,
    total_no BIGINT DEFAULT 0,
    total_amount BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS trades (
    id BIGSERIAL,
    market_pubkey VARCHAR(44) NOT NULL REFERENCES markets(market_pubkey),
    user_pubkey VARCHAR(44) NOT NULL,
    direction VARCHAR(20) NOT NULL, 
    amount_in BIGINT NOT NULL,
    amount_out BIGINT NOT NULL,
    signature VARCHAR(88) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, executed_at)
);

SELECT create_hypertable('trades', 'executed_at', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS positions (
    owner_pubkey VARCHAR(44) NOT NULL,
    market_pubkey VARCHAR(44) NOT NULL REFERENCES markets(market_pubkey),
    yes_shares BIGINT DEFAULT 0,
    no_shares BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_pubkey, market_pubkey)
);


CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_pubkey, executed_at DESC);
