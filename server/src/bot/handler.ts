import { getSession } from "../services/supabase.js";
import { handleCommand } from "./commands.js";
import { newSearch, followUp, handlePlaceSelection } from "../core/pipeline.js";
import { sendTyping, sendError, answerCallbackQuery } from "./sender.js";
import { clearSession } from "../services/supabase.js";
import { sendMessage } from "./sender.js";

/**
 * Main entry point for all Telegram webhook updates.
 * Routes to either callback query handler or message handler.
 */
export const handleUpdate = async (update: any) => {
  try {
    // Route 1: Callback query (user pressed an inline button)
    if (update.callback_query) {
      return await handleCallbackQuery(update.callback_query);
    }

    // Route 2: Text message
    if (update.message?.text) {
      return await handleMessage(update.message);
    }
  } catch (error) {
    console.error("Error handling update:", error);
    const chatId =
      update?.message?.chat?.id || update?.callback_query?.message?.chat?.id;
    if (chatId) {
      await sendError(chatId);
    }
  }
};

/**
 * Handles callback queries from inline keyboard button presses.
 */
const handleCallbackQuery = async (callback: any) => {
  const callbackData = callback.data as string;
  const chatId = callback.message?.chat?.id;
  const messageId = callback.message?.message_id;

  // Always acknowledge the callback to stop the loading animation
  await answerCallbackQuery(callback.id);

  if (!chatId) return;

  // Parse callback data
  if (callbackData.startsWith("select_place:")) {
    const index = parseInt(callbackData.split(":")[1] || "0", 10);
    const session = await getSession(chatId);
    if (
      session?.pending_places &&
      index >= 0 &&
      index < session.pending_places.length
    ) {
      await handlePlaceSelection(chatId, index, session, messageId);
    }
    return;
  }

  if (callbackData.startsWith("search:")) {
    const query = callbackData.substring(7); // Remove "search:" prefix
    await newSearch(chatId, query);
    return;
  }

  if (callbackData === "clear_session") {
    await clearSession(chatId);
    await sendMessage(
      chatId,
      "Session cleared! Send a place name to start fresh. 🔍",
    );
    return;
  }

  if (callbackData.startsWith("ask:")) {
    const question = callbackData.substring(4); // Remove "ask:" prefix
    const session = await getSession(chatId);
    if (session && session.mode === "active_place") {
      await followUp(chatId, question, session);
    }
    return;
  }
};

/**
 * Handles text messages — routes by session state (state machine).
 */
const handleMessage = async (message: any) => {
  const chatId = message.chat.id;
  const text = message.text.trim();

  // Commands always take priority
  if (text.startsWith("/")) {
    const result = await handleCommand(chatId, text);
    // If /search returned a query, route it to newSearch
    if (result?.action === "search") {
      await newSearch(chatId, result.query);
    }
    return;
  }

  await sendTyping(chatId);

  const session = await getSession(chatId);
  const mode = session?.mode || "idle";

  switch (mode) {
    case "idle":
      // No active session — everything is a new search
      await newSearch(chatId, text);
      break;

    case "choosing_place":
      // User typed text instead of pressing a button — treat as a new search
      // (clears the pending_places state)
      await newSearch(chatId, text);
      break;

    case "active_place":
      // Determine if this is a follow-up or a new search using heuristics
      if (looksLikeNewSearch(text)) {
        await newSearch(chatId, text);
      } else if (session) {
        await followUp(chatId, text, session);
      }
      break;
  }
};

/**
 * Simple heuristic to detect if a message looks like a new place search
 * rather than a follow-up question. No LLM needed.
 */
const looksLikeNewSearch = (text: string): boolean => {
  // Questions are almost always follow-ups
  if (text.endsWith("?")) return false;

  // Longer messages are likely follow-ups/commentary
  if (text.length > 80) return false;

  // Short messages with few words are likely place names
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 5) return true;

  return false;
};
