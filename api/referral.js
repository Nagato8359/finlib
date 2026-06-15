// POST /api/referral — process a referral code at registration (service_role key required)
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { referral_code, referred_id } = req.body || {};
  if (!referral_code || !referred_id) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  const code = String(referral_code).trim().toUpperCase();

  const { data: referrer } = await supabase
    .from('user_data')
    .select('user_id, pro_bonus_months')
    .eq('referral_code', code)
    .single();

  if (!referrer) return res.status(404).json({ error: 'Code de parrainage invalide' });
  if (referrer.user_id === referred_id) return res.status(400).json({ error: 'Auto-parrainage interdit' });

  const { data: existing } = await supabase
    .from('referrals').select('id').eq('referred_id', referred_id).maybeSingle();
  if (existing) return res.status(400).json({ error: 'Compte déjà parrainé' });

  const { error: insErr } = await supabase.from('referrals').insert({
    referrer_id: referrer.user_id,
    referred_id,
    status: 'confirmed',
    bonus_months: 1,
  });
  if (insErr) {
    console.error('[referral] insert error:', insErr.message);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }

  // Credit referrer
  await supabase.from('user_data')
    .update({ pro_bonus_months: (referrer.pro_bonus_months || 0) + 1 })
    .eq('user_id', referrer.user_id);

  // Try to credit referred user (their row may not exist yet — OK to fail)
  await supabase.from('user_data')
    .update({ pro_bonus_months: 1, referred_by: code })
    .eq('user_id', referred_id);

  return res.json({ ok: true, bonus_months: 1 });
};
