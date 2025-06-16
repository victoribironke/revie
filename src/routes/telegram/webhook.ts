import type { Update } from "node-telegram-bot-api";
import { TABLES } from "../../lib/constants";
import { supabase } from "../../services/supabase";
import { bot } from "../../services/telegram";
import { tools } from "../../services/gemini";
import type { Message } from "../../types";
import {
  executeTool,
  checkAndRetrieveUser,
  getConversationHistory,
  sendMessageToLLM,
} from "../../lib/helpers";

export const telegramWebhook = async (request: Request) => {
  try {
    const update = (await request.json()) as Update;

    if (!update.message || !update.message.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = update.message.chat.id;
    const userMessage = update.message.text.trim();
    const from = update.message.from;

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

    let finalResponseText: string =
      "I'm having trouble understanding. Please try again.";
    let currentTurn = 0;
    const maxTurns = 3;

    while (currentTurn < maxTurns) {
      const rawLLMResponse = await sendMessageToLLM(messagesForLLM, tools);
      const cleanedResponse = rawLLMResponse
        .replace("```json", "")
        .replace("```", "");

      const parsedLLMResponse = cleanedResponse.includes("{")
        ? JSON.parse(cleanedResponse)
        : { text: cleanedResponse };

      if (parsedLLMResponse.tool) {
        const toolName = parsedLLMResponse.tool;
        const toolParameters = parsedLLMResponse.parameters || {};

        console.log(
          `LLM requested tool: ${toolName} with params:`,
          toolParameters
        );

        const toolOutput = await executeTool(
          toolName,
          toolParameters,
          chatId,
          userRecord
        );

        console.log(`Tool '${toolName}' executed. Output:`, toolOutput);

        messagesForLLM.push(
          {
            role: "model",
            parts: [
              {
                text: JSON.stringify({
                  tool: toolName,
                  parameters: toolParameters,
                }),
              },
            ],
          },
          {
            role: "user",
            parts: [
              {
                text: `Tool '${toolName}' executed with output: ${toolOutput}`,
              },
            ],
          }
        );

        currentTurn++;
      } else if (parsedLLMResponse.text) {
        finalResponseText = parsedLLMResponse.text;

        messagesForLLM.push({
          role: "model",
          parts: [{ text: finalResponseText }],
        });

        break;
      } else {
        console.warn(
          "LLM response did not contain 'tool' or 'text' key:",
          parsedLLMResponse
        );

        finalResponseText =
          "The AI sent an unexpected response. Please try clarifying your request.";

        break;
      }
    }

    if (currentTurn >= maxTurns && !finalResponseText) {
      finalResponseText =
        "I'm having difficulty completing that request. Could you simplify or try a different approach?";
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

    const chatId =
      (error as any).update?.message?.chat?.id || (error as any).chatId;

    if (chatId) {
      await bot.sendMessage(
        chatId,
        "An unexpected server error occurred. Please try again later."
      );
    }

    return new Response("OK", { status: 200 });
  }
};
