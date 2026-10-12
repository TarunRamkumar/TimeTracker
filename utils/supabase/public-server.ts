import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseEnv } from '@/utils/supabase/config';

export function createPublicServerClient() {
  const { supabaseUrl, supabaseKey } = getSupabaseEnv();

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
