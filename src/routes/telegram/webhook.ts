import type { Update } from "node-telegram-bot-api";
import { TABLES } from "../../lib/constants";
import { supabase } from "../../services/supabase";
import { bot } from "../../services/telegram";

export const telegramWebhook = async (request: Request) => {
  try {
    const update = (await request.json()) as Update;

    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const userMessage = update.message.text;
    const from = update.message.from;

    await bot.sendChatAction(chatId, "typing");

    let userRecord;

    try {
      let { data: user, error } = await supabase
        .from(TABLES.users)
        .select("*")
        .eq("telegram_user_id", chatId)
        .single();

      if (error && error.code === "PGRST116") {
        // No rows found
        console.log(`New user: ${chatId}. Creating record.`);

        const { data: newUser, error: createError } = await supabase
          .from(TABLES.users)
          .insert({
            telegram_user_id: chatId,
            telegram_username: from?.username,
            first_name: from?.first_name,
            last_name: from?.last_name,
          })
          .select("*");

        if (createError) throw createError;

        userRecord = newUser?.[0];

        if (!userRecord) throw new Error("Failed to create user record.");
      } else if (error) throw error;
      else userRecord = user;
    } catch (dbError) {
      console.error("Database error during user check/creation:", dbError);

      await bot.sendMessage(
        chatId,
        "Oops! Something went wrong on my end (database error). Please try again later."
      );

      return new Response("OK", { status: 200 });
    }

    await bot.sendMessage(
      chatId,
      "Hello! I'm your AI assistant. How can I help you today?"
    );

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing Telegram webhook:", error);

    return new Response("OK", { status: 200 });
  }
};
