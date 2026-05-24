import { sendMessage, sendMessageWithKeyboard } from "./sender.js";
import { clearSession } from "../services/supabase.js";

export const handleCommand = async (chatId: number, text: string) => {
  const command = text.split(" ")[0]?.toLowerCase();

  switch (command) {
    case "/start":
      await sendMessageWithKeyboard(
        chatId,
        "Hey! 👋 Send me the name of any place and I'll read the Google Maps reviews to tell you if it's worth your time.\n\nTry one of these to see how it works:",
        [
          [
            {
              text: "🍔 Chicken Republic, Yaba",
              callback_data: "search:Chicken Republic Yaba",
            },
          ],
          [
            {
              text: "☕ Cafe Neo, Victoria Island",
              callback_data: "search:Cafe Neo Victoria Island",
            },
          ],
          [
            {
              text: "🎭 Terra Kulture, Lagos",
              callback_data: "search:Terra Kulture Lagos",
            },
          ],
        ],
      );
      break;

    case "/help":
      await sendMessage(
        chatId,
        "Here's what I can do:\n\n" +
          "• Send a place name to get a summary of its reviews.\n" +
          "• Ask follow-up questions to dig deeper.\n" +
          "• Type a new place name anytime to start a new search.\n" +
          "• Use /end to clear your current session.",
      );
      break;

    case "/end":
      await clearSession(chatId);
      await sendMessage(
        chatId,
        "Session cleared! Send a place name to start fresh. 🔍",
      );
      break;

    case "/search":
      // Strip the command prefix and treat the rest as a search query
      const query = text.replace(/^\/search\s*/i, "").trim();
      if (query) {
        // Return the query so the caller can route it to newSearch
        return { action: "search" as const, query };
      }
      await sendMessage(
        chatId,
        "Usage: <code>/search Place Name, City</code>\n\nOr just type the place name directly!",
      );
      break;

    default:
      await sendMessage(
        chatId,
        "Unknown command. Send /help to see what I can do.",
      );
  }

  return null;
};
