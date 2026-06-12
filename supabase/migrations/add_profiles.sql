-- Migration: add multi-profile support
-- Run this in the Supabase SQL editor before using the profile switcher.

-- 1. Table profiles: one row per named profile per user
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Principal',
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profiles" ON profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add profile_id column to user_data
--    NULL = "Principal" / legacy row (backward-compatible)
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Unique constraints:
--    One legacy row per user (profile_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS user_data_principal_uq
  ON user_data(user_id)
  WHERE profile_id IS NULL;

--    One row per (user, named profile)
CREATE UNIQUE INDEX IF NOT EXISTS user_data_profile_uq
  ON user_data(user_id, profile_id)
  WHERE profile_id IS NOT NULL;
