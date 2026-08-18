import { supabase } from "./supabase.js";

type EventType =
  | "search"
  | "recommendation"
  | "place_selected"
  | "follow_up"
  | "session_cleared";

/**
 * Fire-and-forget event logger. Never throws — analytics
 * should never break the user experience.
 */
export const trackEvent = (
  chatId: number,
  event: EventType,
  metadata?: Record<string, unknown>,
) => {
  supabase
    .from("events")
    .insert({
      chat_id: chatId,
      event,
      metadata: metadata ?? null,
    })
    .then(({ error }) => {
      if (error) console.error("[analytics] Failed to log event:", error);
    });
};
