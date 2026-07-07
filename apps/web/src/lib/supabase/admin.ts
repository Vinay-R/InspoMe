import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

export function createAdminClient() {
  return createClient(env.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
