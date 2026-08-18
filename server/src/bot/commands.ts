import { sendMessage, sendMessageWithKeyboard } from "./sender.js";
import { clearSession } from "../services/supabase.js";

export const handleCommand = async (chatId: number, text: string) => {
  const command = text.split(" ")[0]?.toLowerCase();

  switch (command) {
    case "/start":
      await clearSession(chatId);
      await sendMessage(
        chatId,
        "👋 <b>Welcome to Revie!</b>\n\n" +
          "I help you find the best spots and chat with real reviews.\n\n" +
          "<b>What you can do:</b>\n" +
          '• <b>Ask for recommendations:</b> <i>"Good cafe spots in Lagos"</i> or <i>"Best rooftop bars in VI"</i>\n' +
          '• <b>Inspect a specific place:</b> Send a place name (e.g. <i>"Terra Kulture Lagos"</i>) or share a Google Maps link.\n' +
          "• <b>Chat with reviews:</b> Once a place is selected, ask anything about WiFi, price, food, or vibe!\n\n" +
          "Type your query to get started!",
      );
      break;

    case "/help":
      await sendMessage(
        chatId,
        "<b>Here's how to use Revie:</b>\n\n" +
          '• <b>Recommendations:</b> Ask naturally like <i>"recommend cozy cafes in Lagos"</i> or use <code>/recommend &lt;category in city&gt;</code>\n' +
          "• <b>Place Lookup:</b> Send any place name or Google Maps link to get a review summary.\n" +
          "• <b>Follow-up & Chat:</b> Ask any specific questions about food, parking, prices, or vibe.\n" +
          "• <code>/newsearch &lt;place&gt;</code> — Search for a specific place\n" +
          "• <code>/recommend &lt;category&gt;</code> — Get ranked recommendations\n" +
          "• <code>/end</code> — Clear your session and start fresh.",
      );
      break;

    case "/end":
      await clearSession(chatId);
      await sendMessage(
        chatId,
        "Session cleared! Send a place name or ask for recommendations to start fresh. 🔍",
      );
      break;

    case "/recommend":
    case "/suggest": {
      const query = text.replace(/^\/(?:recommend|suggest)\s*/i, "").trim();
      if (query) {
        return { action: "recommend" as const, query };
      }
      await sendMessage(
        chatId,
        'Usage: <code>/recommend cafes in Lagos</code>\n\nOr just ask naturally: <i>"show me good cafe spots in Lagos"</i>!',
      );
      break;
    }

    case "/search":
    case "/newsearch": {
      const query = text.replace(/^\/(?:new)?search\s*/i, "").trim();
      if (query) {
        return { action: "search" as const, query };
      }
      await sendMessage(
        chatId,
        "Usage: <code>/newsearch Place Name, City</code>\n\nOr just type the place name or paste a Maps link directly!",
      );
      break;
    }

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
