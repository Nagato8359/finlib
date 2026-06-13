const { createClient } = require('@supabase/supabase-js');

const url     = process.env.SUPABASE_URL     || process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

// Public read (prices_cache SELECT policy allows anon)
exports.supabaseAnon  = createClient(url, anonKey);

// Service role for privileged reads (user_data) and writes (prices_cache upsert)
exports.supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey);
