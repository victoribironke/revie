import type TelegramBot from "node-telegram-bot-api";
import { model, tools } from "../services/gemini";
import { supabase } from "../services/supabase";
import { bot } from "../services/telegram";
import { TABLES } from "./constants";
import type { Message, User } from "../types";

export const checkAndRetrieveUser = async (
  chatId: number,
  from: TelegramBot.User | undefined
) => {
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
          telegram_username: from?.username || "",
          first_name: from?.first_name || "",
          last_name: from?.last_name || "",
        })
        .select("*");

      if (createError) throw createError;
      if (!newUser?.[0]) throw new Error("Failed to create user record.");

      return { data: newUser?.[0] as User, error: null };
    } else if (error) throw error;
    else return { data: user as User, error: null };
  } catch (dbError) {
    return { data: null, error: dbError };
  }
};

export const getConversationHistory = async (chatId: number) => {
  try {
    const messagesForLLM: Message[] = [];

    const { data: conversationHistory, error: historyError } = await supabase
      .from(TABLES.conversations)
      .select("message, response")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(10);

    if (historyError) throw historyError;

    if (conversationHistory) {
      for (const turn of conversationHistory) {
        messagesForLLM.push({
          role: "user",
          parts: [{ text: turn.message }],
        });

        if (turn.response) {
          messagesForLLM.push({
            role: "model",
            parts: [{ text: turn.response }],
          });
        }
      }
    }

    return { data: messagesForLLM, error: null };
  } catch (historyError) {
    return { data: null, error: historyError };
  }
};

export const summarizeReviewData = async (
  topic: string,
  question: string,
  reviewData: string
): Promise<string> => {
  const reviewLLMPrompt = `
          You are an AI assistant specialized in summarizing user reviews.
          Analyze the provided review data for '${topic}' and answer the user's specific question.
          Focus solely on common sentiments and facts from the reviews. Do NOT invent information.
          Be concise and direct.
  
          Topic: ${topic}
          User's Specific Question: ${question}
          Review Data:
          ---
          ${reviewData}
          ---
  
          Provide a summary or answer based only on the provided Review Data:
      `;

  try {
    const result = await model.generateContent(reviewLLMPrompt);

    return result.response.text();
  } catch (llmError: any) {
    console.error(
      "Error summarizing review data with LLM:",
      llmError.response?.data || llmError.message || llmError
    );

    return `(Error) I'm having trouble getting detailed insights about "${topic}" right now. Please try a different question or topic.`;
  }
};

export const fetchSimulatedReviewData = async (
  topic: string,
  type: "all" | "pros" | "cons"
): Promise<string> => {
  // In a real scenario, this would query your Supabase table for reviews related to the topic,
  // or call an external review API.
  // For now, we'll return a simple simulated string based on topic/type.
  console.log(`Simulating fetching ${type} reviews for: ${topic}`);
  if (topic.toLowerCase().includes("spotify")) {
    if (type === "pros")
      return "Reviews often praise Spotify's vast music library, personalized playlists (Discover Weekly!), and seamless cross-device syncing. Users love the intuitive UI and offline listening.";
    if (type === "cons")
      return "Common complaints include high battery usage, occasional bugs with downloads, and the free tier having too many ads and limited skips. Some find the podcast integration clunky.";
    return "Spotify reviews are generally positive about its content library and personalization. Main issues are battery drain and ads on free tier.";
  }
  if (topic.toLowerCase().includes("iphone")) {
    if (type === "pros")
      return "iPhone reviews consistently highlight its powerful camera, intuitive iOS, excellent app ecosystem, and strong security features. Battery life is often praised on Pro models.";
    if (type === "cons")
      return "Reviewers often point out the high price, proprietary charging cables, and limited customization options compared to Android. Some find battery life on standard models average.";
    return "iPhone reviews mention high quality cameras and smooth iOS, but criticize the high cost and limited customization.";
  }
  if (topic.toLowerCase().includes("starbucks")) {
    if (type === "pros")
      return "Starbucks reviews commend its consistent coffee quality, widespread availability, and mobile ordering convenience. The atmosphere and WiFi are often a plus for working.";
    if (type === "cons")
      return "Common complaints are high prices, long wait times during peak hours, and sometimes inconsistent drink preparation. Some find the environment too noisy.";
    return "Starbucks reviews praise convenience and quality, but note high prices and potential for long waits.";
  }
  return `No specific simulated review data for '${topic}'.`;
};

export const executeTool = async (
  toolName: string,
  parameters: any,
  chatId: number,
  userRecord: any
): Promise<string> => {
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    return `Error: Tool '${toolName}' not found.`;
  }

  try {
    // Pass userRecord and chatId to tools if they need context (e.g., current_topic_name)
    return await tool.execute(parameters, chatId, userRecord);
  } catch (error) {
    console.error(`Error executing tool ${toolName}:`, error);
    return "Sorry, something went wrong while performing that action.";
  }
};
