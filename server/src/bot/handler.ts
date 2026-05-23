import { getSession } from "../services/supabase.js";
import { classifyIntent } from "../core/intent.js";
import { handleCommand } from "./commands.js";
import { newSearch, followUp } from "../core/pipeline.js";
import { sendTyping, sendError } from "./sender.js";

export const handleUpdate = async (update: any) => {
  try {
    if (!update.message || !update.message.text) return;

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    await sendTyping(chatId);

    const session = await getSession(chatId);
    const hasSession = !!session?.current_place || !!session?.pending_places;

    const intent = await classifyIntent(text, hasSession);

    switch (intent) {
      case "command":
        await handleCommand(chatId, text);
        break;
      case "new_search":
        await newSearch(chatId, text, session);
        break;
      case "followup":
        if (session) {
          await followUp(chatId, text, session);
        } else {
          await newSearch(chatId, text);
        }
        break;
    }
  } catch (error) {
    console.error("Error handling update:", error);
    if (update?.message?.chat?.id) {
      await sendError(update.message.chat.id);
    }
  }
};
