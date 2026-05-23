import { sendMessage } from "./sender.js";
import { clearSession } from "../services/supabase.js";

export const handleCommand = async (chatId: number, text: string) => {
  const command = text.split(" ")[0]?.toLowerCase();

  switch (command) {
    case "/start":
      await sendMessage(
        chatId,
        "Welcome to ReviewBot! 📍\n\nSend me the name of any place (e.g. 'Chicken Republic, Lagos') and I'll summarize what people are saying about it on Google Maps. You can also ask follow-up questions!",
      );
      break;
    case "/help":
      await sendMessage(
        chatId,
        "Here's what I can do:\n\n- Send a place name to get a summary of its reviews.\n- Ask a follow-up question to dig deeper into the current place's reviews.\n- Type a new place name to start a new search.\n- Use /clear to reset your session completely.",
      );
      break;
    case "/clear":
      await clearSession(chatId);
      await sendMessage(
        chatId,
        "Your session has been cleared. You can start fresh by sending a new place name.",
      );
      break;
    default:
      await sendMessage(
        chatId,
        "Unknown command. Send /help to see what I can do.",
      );
  }
};
