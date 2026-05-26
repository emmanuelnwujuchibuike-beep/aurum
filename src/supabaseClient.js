import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://ttwwthfeordsojmcjwxn.supabase.co';
// ⚠️  Paste your real anon/public key from Supabase → Project Settings → API
const supabaseAnonKey = 'sb_publishable_4n9plwkFECKUtl4z2aTqRA_qEqtCNvv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);