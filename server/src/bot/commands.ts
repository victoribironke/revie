import { sendMessage, sendMessageWithKeyboard } from "./sender.js";
import { clearSession } from "../services/supabase.js";

export const handleCommand = async (chatId: number, text: string) => {
  const command = text.split(" ")[0]?.toLowerCase();

  switch (command) {
    case "/start":
      await clearSession(chatId);
      await sendMessage(
        chatId,
        "📍 <b>Let's check a place.</b>\n" +
          "The fastest way is to share the location directly from Google Maps.\n" +
          "1. Open Google Maps\n" +
          '2. Hit "Share" on the place\n' +
          "3. Paste the link here!\n" +
          '<i>(You can also just type the name, like "Cafe Neo Lagos".)</i>',
      );
      break;

    case "/help":
      await sendMessage(
        chatId,
        "Here's what I can do:\n\n" +
          "• Send a place name or Google Maps link to get a summary of its reviews.\n" +
          "• Ask follow-up questions to dig deeper.\n" +
          "• Use /newsearch to start a new search anytime.\n" +
          "• Use /history to view your past searches (coming soon).\n" +
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
    case "/newsearch":
      // Strip the command prefix and treat the rest as a search query
      const query = text.replace(/^\/(?:new)?search\s*/i, "").trim();
      if (query) {
        // Return the query so the caller can route it to newSearch
        return { action: "search" as const, query };
      }
      await sendMessage(
        chatId,
        "Usage: <code>/newsearch Place Name, City</code>\n\nOr just type the place name or paste a Maps link directly!",
      );
      break;

    case "/history":
      await sendMessage(
        chatId,
        "The history feature is coming soon! For now, your recent searches are only available during your active session.",
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
