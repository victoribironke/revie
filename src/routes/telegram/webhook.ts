import type { CallbackQuery, Update } from "node-telegram-bot-api";
import { TABLES } from "../../lib/constants";
import { supabase } from "../../services/supabase";
import { bot } from "../../services/telegram";
import type { Message } from "../../types";
import {
  executeTool,
  checkAndRetrieveUser,
  getConversationHistory,
  sendMessageToLLM,
  checkAndRetrieveConversationState,
} from "../../lib/helpers";
import type TelegramBot from "node-telegram-bot-api";

export const telegramWebhook = async (request: Request) => {
  const update = (await request.json()) as Update;

  const handleCallback = async (callbackQuery: CallbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const callbackData = callbackQuery.data;
    const messageId = callbackQuery.message?.message_id;
    const from = callbackQuery.message?.from;

    if (!chatId || !callbackData || !messageId) return new Response("OK");

    await bot.sendChatAction(chatId, "typing");
    await bot.answerCallbackQuery(callbackQuery.id);

    const { data: userRecord, error: userError } = await checkAndRetrieveUser(
      chatId,
      from
    );

    if (userError) {
      await bot.sendMessage(
        chatId,
        "Oops! Something went wrong. Try again later."
      );

      return new Response("OK");
    }

    if (callbackData === "check_reviews") {
      const result = await executeTool("check_reviews", {}, chatId, userRecord);

      await bot.editMessageText(result, {
        chat_id: chatId,
        message_id: messageId,
      });

      return new Response("OK");
    }

    const { data: state } = await supabase
      .from(TABLES.conversation_state)
      .select("state")
      .eq("chat_id", chatId)
      .single();

    if (state?.state !== "waiting_for_place_selection") {
      await bot.sendMessage(chatId, "Please search for a place first.");

      return new Response("OK");
    }

    const finalResponse = await executeTool(
      "select_place",
      { selected_index: callbackData },
      chatId,
      userRecord
    );

    await bot.editMessageText(finalResponse, {
      chat_id: chatId,
      message_id: messageId,
    });

    await supabase.from(TABLES.conversations).insert({
      user_id: userRecord?.id || "",
      chat_id: chatId,
      message: `Selected: ${callbackData}`,
      response: finalResponse,
      created_at: new Date().toISOString(),
    });

    return new Response("OK");
  };

  const handleMessage = async (message: TelegramBot.Message) => {
    const chatId = message.chat.id;
    const text = message.text?.trim();
    const from = message.from;

    if (!text) return new Response("OK");

    if (text.toLowerCase() === "/start") {
      await executeTool("reset_conversation", {}, chatId, "");

      await bot.sendMessage(
        chatId,
        `👋 Hello! I’m Revie — your guide to real reviews of places.

You can search for places like restaurants, shops, parks... and ask what people are saying.

What would you like to search for today?`
      );
      return new Response("OK");
    }

    if (text.toLowerCase() === "/reset") {
      await executeTool("reset_conversation", {}, chatId, "");
      await bot.sendMessage(
        chatId,
        "✅ Conversation reset. Tell me the name of a place you’d like to chat about!"
      );
      return new Response("OK");
    }

    await bot.sendChatAction(chatId, "typing");

    const { data: userRecord } = await checkAndRetrieveUser(chatId, from);
    const { data: state } = await checkAndRetrieveConversationState(
      chatId,
      userRecord?.id || ""
    );

    if (state?.state === "waiting_for_place_selection" && /^\d+$/.test(text)) {
      const result = await executeTool(
        "select_place",
        { selected_index: text },
        chatId,
        userRecord
      );

      await bot.sendMessage(chatId, result);

      return new Response("OK");
    }

    const { data: conversationHistory, error: historyError } =
      await getConversationHistory(chatId);

    if (historyError) {
      console.error("Error fetching conversation history:", historyError);
    }

    const messages: Message[] = [
      ...(conversationHistory || []),
      { role: "user", parts: [{ text }] },
    ];
    const llmResponse = await sendMessageToLLM(messages);

    try {
      const parsed = JSON.parse(llmResponse);

      if (parsed.tool) {
        const result = await executeTool(
          parsed.tool,
          parsed.parameters,
          chatId,
          userRecord
        );

        await bot.sendMessage(chatId, result);
      } else if (parsed.text) {
        await bot.sendMessage(chatId, parsed.text);
      }
    } catch {
      await bot.sendMessage(
        chatId,
        llmResponse || "Something went wrong. Try again."
      );
    }

    await supabase.from(TABLES.conversations).insert({
      user_id: userRecord?.id || "",
      chat_id: chatId,
      message: text,
      response: llmResponse,
      created_at: new Date().toISOString(),
    });

    return new Response("OK");
  };

  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);

  console.log("Received update:", update);

  return new Response("OK");
};
