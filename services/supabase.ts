import { createClient } from "@supabase/supabase-js";
import { CREDENTIALS } from "../lib/constants";

const supabaseUrl = CREDENTIALS.supabase_url;
const supabaseServiceRoleKey = CREDENTIALS.supabase_service_role_key;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Supabase URL and Service Role Key must be set in .env");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
