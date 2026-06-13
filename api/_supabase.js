const { createClient } = require('@supabase/supabase-js');

const url     = process.env.SUPABASE_URL     || process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Public read (prices_cache SELECT policy allows anon)
exports.supabaseAnon = createClient(url, anonKey);

// Service role for privileged reads (user_data) and writes (prices_cache upsert)
// Lazily initialized — throws explicitly if SUPABASE_SERVICE_ROLE_KEY is absent
let _admin = null;
Object.defineProperty(exports, 'supabaseAdmin', {
  get() {
    if (_admin) return _admin;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    _admin = createClient(url, key);
    return _admin;
  },
});
