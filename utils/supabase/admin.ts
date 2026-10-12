import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseEnv } from '@/utils/supabase/config';

export function createAdminClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient<Database>(supabaseUrl, serviceRoleKey ?? supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
