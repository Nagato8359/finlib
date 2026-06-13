CREATE TABLE IF NOT EXISTS patrimoine_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valeur      NUMERIC     NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL
);

-- One snapshot per user per hour (used as upsert conflict target)
CREATE UNIQUE INDEX IF NOT EXISTS idx_patrimoine_history_user_hour
  ON patrimoine_history(user_id, recorded_at);

ALTER TABLE patrimoine_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own history" ON patrimoine_history
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
