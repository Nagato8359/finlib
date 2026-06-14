CREATE TABLE IF NOT EXISTS dividend_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker       TEXT NOT NULL,
  ex_date      DATE,
  payment_date DATE,
  amount       NUMERIC NOT NULL,
  currency     TEXT DEFAULT 'USD',
  amount_eur   NUMERIC,
  status       TEXT DEFAULT 'confirmed',
  source       TEXT DEFAULT 'yahoo',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticker, ex_date)
);

ALTER TABLE dividend_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read dividend_events"
  ON dividend_events FOR SELECT USING (true);

CREATE POLICY "Service role write dividend_events"
  ON dividend_events FOR ALL USING (auth.role() = 'service_role');
