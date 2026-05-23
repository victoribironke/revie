import { createClient } from "@supabase/supabase-js";
import type { Session } from "../types.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSession = async (chatId: number): Promise<Session | null> => {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("chat_id", chatId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Supabase getSession error:", error);
    return null;
  }
  return data as Session | null;
};

export const saveSession = async (session: Session): Promise<void> => {
  const { error } = await supabase.from("sessions").upsert({
    ...session,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Supabase saveSession error:", error);
  }
};

export const clearSession = async (chatId: number): Promise<void> => {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("chat_id", chatId);

  if (error) {
    console.error("Supabase clearSession error:", error);
  }
};
