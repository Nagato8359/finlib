CREATE TABLE IF NOT EXISTS prices_cache (
  ticker     TEXT PRIMARY KEY,
  price      NUMERIC,
  change_pct NUMERIC,
  currency   TEXT DEFAULT 'EUR',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prices_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON prices_cache FOR SELECT USING (true);
