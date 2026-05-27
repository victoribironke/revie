import { getSession } from "../services/supabase.js";
import { handleCommand } from "./commands.js";
import { newSearch, followUp, handlePlaceSelection } from "../core/pipeline.js";
import { sendTyping, sendError, answerCallbackQuery } from "./sender.js";
import { clearSession } from "../services/supabase.js";
import { sendMessage } from "./sender.js";
import { trackEvent } from "../services/analytics.js";
import {
  classifyIntent,
  extractPlaceFromUrl as extractPlaceWithLLM,
} from "../services/llm.js";

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
    const parts = callbackData.split(":");
    const placeId = parts[1];
    const question = parts.slice(2).join(":");
    const session = await getSession(chatId);
    if (session && session.state === "CHATTING") {
      const currentId =
        session.current_place?.place_id || session.current_place?.data_id;
      if (currentId === placeId || !currentId) {
        await followUp(chatId, question, session);
      } else {
        await answerCallbackQuery(callback.id, {
          text: "This button is for a previous search. Please ask about the current place.",
          show_alert: true,
        });
      }
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
  const genericUrlMatch = text.match(/(https?:\/\/[^\s]+)/);
  if (genericUrlMatch) {
    const url = genericUrlMatch[1]!;
    if (url.includes("maps.app.goo.gl") || url.includes("google.com/maps")) {
      const extractedQuery = await extractQueryFromUrl(url);
      if (extractedQuery) {
        await newSearch(chatId, extractedQuery);
        return;
      }
    } else {
      const extractedPlace = await extractPlaceWithLLM(url);
      if (extractedPlace) {
        await newSearch(chatId, extractedPlace);
        return;
      }
    }
  }

  const session = await getSession(chatId);

  // Use LLM to classify intent
  const { intent, refinedQuery } = await classifyIntent(text);

  if (intent === "greeting") {
    await sendMessage(
      chatId,
      "👋 Hello! I'm Revie. Send me a place name or link, and I'll summarize its reviews for you. You can also ask me specific questions about it!",
    );
    return;
  }

  if (intent === "search_place") {
    await newSearch(chatId, refinedQuery || text);
    return;
  }

  if (session && session.state === "CHATTING" && session.current_place) {
    await followUp(chatId, text, session);
  } else {
    // Treat as search if we have no active session but the LLM thought it was a follow-up
    await newSearch(chatId, refinedQuery || text);
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
