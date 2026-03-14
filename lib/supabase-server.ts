import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — only used in server-side API routes / Server Actions
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
