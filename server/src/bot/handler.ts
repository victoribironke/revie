import { getSession } from "../services/supabase.js";
import { handleCommand } from "./commands.js";
import { newSearch, followUp, handlePlaceSelection } from "../core/pipeline.js";
import { sendTyping, sendError, answerCallbackQuery } from "./sender.js";
import { clearSession } from "../services/supabase.js";
import { sendMessage } from "./sender.js";
import { trackEvent } from "../services/analytics.js";

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
    trackEvent(chatId, "session_cleared");
    await sendMessage(
      chatId,
      "Session cleared! Send a place name to start fresh. 🔍",
    );
    return;
  }

  if (callbackData.startsWith("ask:")) {
    const question = callbackData.substring(4); // Remove "ask:" prefix
    const session = await getSession(chatId);
    if (session && session.state === "CHATTING") {
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

  // Path A: URL Detected
  const urlMatch = text.match(
    /(https?:\/\/(?:www\.)?(?:maps\.app\.goo\.gl|google\.com\/maps)[^\s]*)/,
  );
  if (urlMatch) {
    const extractedQuery = await extractQueryFromUrl(urlMatch[1]!);
    if (extractedQuery) {
      await newSearch(chatId, extractedQuery);
      return;
    }
  }

  const session = await getSession(chatId);
  const state = session?.state || "IDLE";

  switch (state) {
    case "IDLE":
      // No active session — everything is a new search
      await newSearch(chatId, text);
      break;

    case "AWAITING_SELECTION":
      // User typed text instead of pressing a button — treat as a new search
      // (clears the pending_places state)
      await newSearch(chatId, text);
      break;

    case "CHATTING":
      // Determine if this is a follow-up or a new search using heuristics
      if (looksLikeNewSearch(text)) {
        await newSearch(chatId, text);
      } else if (session) {
        await followUp(chatId, text, session);
      }
      break;
  }
};

const extractQueryFromUrl = async (url: string): Promise<string | null> => {
  try {
    // 1. Try to extract from URL parameters first (handles long URLs)
    try {
      const parsedUrl = new URL(url);
      const daddr = parsedUrl.searchParams.get("daddr");
      if (daddr) return daddr;
      const q = parsedUrl.searchParams.get("q");
      if (q) return q;
    } catch (e) {
      // Ignore URL parsing errors
    }

    // 2. Follow redirect (handles short URLs like maps.app.goo.gl)
    const res = await fetch(url);
    const finalUrl = res.url;

    // Check if redirect gave us parameters
    try {
      const parsedFinal = new URL(finalUrl);
      const daddr = parsedFinal.searchParams.get("daddr");
      if (daddr) return daddr;
      const q = parsedFinal.searchParams.get("q");
      if (q) return q;
    } catch (e) {}

    // 3. Fallback to extracting from path (e.g. /maps/place/Cafe+Neo)
    const match = finalUrl.match(/\/maps\/(?:place|search)\/([^/?]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].replace(/\+/g, " "));
    }
  } catch (error) {
    console.error("URL extraction error:", error);
  }
  return null;
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
