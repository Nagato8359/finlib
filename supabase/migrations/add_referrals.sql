CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bonus_months INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', -- pending | confirmed
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

ALTER TABLE user_data ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE user_data ADD COLUMN IF NOT EXISTS pro_bonus_months INTEGER DEFAULT 0;
