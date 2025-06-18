import type { Update } from "node-telegram-bot-api";
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

export const telegramWebhook = async (request: Request) => {
  const update = (await request.json()) as Update;

  if (!update.message || !update.message.text) {
    return new Response("OK", { status: 200 });
  }

  const chatId = update.message.chat.id;
  const userMessage = update.message.text.trim();
  const from = update.message.from;

  try {
    await bot.sendChatAction(chatId, "typing");

    const { data: userRecord, error: userError } = await checkAndRetrieveUser(
      chatId,
      from
    );

    if (userError) {
      console.error("Database error during user check/creation:", userError);

      await bot.sendMessage(
        chatId,
        "Oops! Something went wrong on my end (database error). Please try again later."
      );

      return new Response("OK", { status: 200 });
    }

    const { data: conversationState, error: conversationStateError } =
      await checkAndRetrieveConversationState(chatId, userRecord!.id);

    if (conversationStateError) {
      console.error(
        "Database error during conversation state check/creation:",
        conversationStateError
      );

      await bot.sendMessage(
        chatId,
        "Oops! Something went wrong on my end (database error). Please try again later. If the problem persists, please contact support."
      );

      return new Response("OK", { status: 200 });
    }

    const messagesForLLM: Message[] = [];

    const { data: conversationHistory, error: historyError } =
      await getConversationHistory(chatId);

    if (historyError) {
      console.error("Error fetching conversation history:", historyError);
    }

    if (conversationHistory) {
      for (const message of conversationHistory) {
        messagesForLLM.push(message);
      }
    }

    messagesForLLM.push({ role: "user", parts: [{ text: userMessage }] });

    let finalResponseText: string;

    if (
      conversationState?.state === "waiting_for_place_selection" &&
      /^\d+$/.test(userMessage)
    ) {
      finalResponseText = await executeTool(
        "select_place",
        { selected_index: userMessage },
        chatId,
        userRecord
      );
    } else {
      const rawLLMResponse = await sendMessageToLLM(messagesForLLM);
      const cleanedResponse = rawLLMResponse
        .replace("```json", "")
        .replace("```", "");

      try {
        const parsedLLMResponse = cleanedResponse.includes("{")
          ? JSON.parse(cleanedResponse)
          : { text: cleanedResponse };

        if (parsedLLMResponse.tool) {
          finalResponseText = await executeTool(
            parsedLLMResponse.tool,
            parsedLLMResponse.parameters,
            chatId,
            userRecord
          );
        } else if (parsedLLMResponse.text) {
          finalResponseText =
            parsedLLMResponse.text ||
            "Please tell me the name of a place you’d like to chat about!";
        } else {
          finalResponseText =
            "The AI sent an unexpected response. Please try clarifying your request.";
        }
      } catch (error) {
        console.error("Error parsing LLM response:", error);
        finalResponseText = "Sorry, I couldn’t process that. Please try again.";
      }
    }

    await bot.sendMessage(chatId, finalResponseText);

    try {
      await supabase.from(TABLES.conversations).insert({
        user_id: userRecord!.id,
        chat_id: chatId,
        message: userMessage, // User's initial message
        response: finalResponseText, // The final text sent to the user
        created_at: new Date().toISOString(),
      });
    } catch (dbError) {
      console.error("Error storing final conversation turn:", dbError);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing Telegram webhook:", error);

    await bot.sendMessage(
      chatId,
      "An unexpected server error occurred. Please try again later."
    );

    return new Response("OK", { status: 200 });
  }
};
