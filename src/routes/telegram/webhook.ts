import type { Update } from "node-telegram-bot-api";
import { TABLES } from "../../lib/constants";
import { supabase } from "../../services/supabase";
import { bot } from "../../services/telegram";
import { model, safetySettings, tools } from "../../services/gemini";
import type { Message, Tool } from "../../types";
import {
  executeTool,
  checkAndRetrieveUser,
  getConversationHistory,
} from "../../lib/helpers";

// --- LLM Call Function ---
async function callLLM(
  messages: { role: string; parts: { text: string }[] }[],
  availableTools: Tool[]
): Promise<string> {
  try {
    const systemPrompt =
      `You are a helpful and concise AI assistant for a Telegram bot called "Revie". Your primary function is to help users chat with summaries of user reviews for places, apps, and products.

When a user asks a question, determine if any of the available tools can help answer it.
If a tool is relevant: respond with a JSON object: { "tool": "tool_name", "parameters": { "param1": "value1", ... } }.
If no tool is relevant, or after a tool has been used, respond with a JSON object: { "text": "your_natural_language_response" }.

Keep your direct text responses concise, helpful, and directly answer the user's query based on the information you have or gained from tools.

Available tools: ` +
      JSON.stringify(
        availableTools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }))
      );

    const conversation = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...messages,
    ];

    const result = await model.generateContent({
      contents: conversation,
      safetySettings,
    });

    const llmResponseContent =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!llmResponseContent) {
      console.warn("LLM returned no text content.", result.response);
      return JSON.stringify({
        text: "I received an empty response from the AI. Please try again.",
      });
    }

    return llmResponseContent;
  } catch (error: any) {
    console.error(
      "LLM API error (callLLM):",
      error.response?.data || error.message || error
    );
    return JSON.stringify({
      text: "Sorry, I couldn't process your request with the AI. Please try again.",
    });
  }
}

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
      const rawLLMResponse = await callLLM(messagesForLLM || [], tools);
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
