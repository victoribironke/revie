import type TelegramBot from "node-telegram-bot-api";
import { reviewModel, safetySettings, tools } from "../services/gemini";
import { supabase } from "../services/supabase";
import { TABLES } from "./constants";
import type { ConversationState, Message, Place, Tool, User } from "../types";

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
          current_place_id: null,
          current_place_name: null,
          last_fetched_reviews_at: null,
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

export const checkAndRetrieveConversationState = async (
  chatId: number,
  user_id: string
) => {
  try {
    let { data: state, error: stateError } = await supabase
      .from("conversation_state")
      .select("*")
      .eq("chat_id", chatId)
      .single();

    if (stateError && stateError.code === "PGRST116") {
      const { data: newState, error: createError } = await supabase
        .from(TABLES.conversation_state)
        .insert({
          user_id,
          chat_id: chatId,
          state: "waiting_for_place_name",
          context: {},
          updated_at: new Date().toISOString(),
        })
        .select("*");

      if (createError) throw createError;
      state = newState?.[0];
    } else if (stateError) throw stateError;

    return { data: state as ConversationState, error: null };
  } catch (error) {
    return { data: null, error: error };
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
) => {
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

export const executeTool = async (
  toolName: string,
  parameters: any,
  chatId: number,
  userRecord: any
) => {
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

export const sendMessageToLLM = async (messages: Message[]) => {
  try {
    const systemPrompt = `
You are Revie, a friendly and concise AI assistant for a Telegram bot focused exclusively on helping users chat about user reviews for places (e.g., restaurants, parks, shops). Your role is to guide users through a specific flow to select a place and discuss its reviews. Do not respond to queries unrelated to places or reviews.

### Conversation Flow:
1. **Request Place Name**: If the user hasn’t provided a place name or isn’t in an active flow, prompt them with: { "text": "Please tell me the name of a place you’d like to chat about!" }.
2. **Search Places**: When the user provides a place name, call the 'search_places' tool with the query.
3. **Place Selection**: When the user responds with a number, call the 'select_place' tool to select the place and check review status.
   - If reviews are being fetched, inform the user: { "text": "Fetching reviews for [Place Name]. I’ll notify you when they’re ready!" }.
   - If reviews are ready, inform the user: { "text": "Reviews for [Place Name] are ready. What would you like to know?" }.
4. **Chatting About Reviews**: Once reviews are available, respond to user queries about the place’s reviews using the 'get_review_insights' tool.

### Your Behavior:
- Always respond in a conversational, polite, and concise manner.
- Stick strictly to the conversation flow above.
- If the user’s message doesn’t fit the current state (e.g., random text when expecting a number), gently redirect them to the expected input.
- For review-related queries, use the 'get_review_insights' tool to provide answers based on stored reviews.
- Do not mention tools, JSON responses, or internal processes in text replies.

### Response Format:
- **Tool Call**: Return a JSON object: { "tool": "tool_name", "parameters": { "param1": "value1", ... } }.
- **Text Response**: Return a JSON object: { "text": "your_natural_language_response" }.
  - Keep text responses concise (1-2 sentences).
  - Use a friendly tone, e.g., "Found some places for you!" or "Which place would you like?"

### Handling Edge Cases:
- If the user asks something unrelated to places (e.g., "What’s the weather?"), respond: { "text": "I’m here to help with place reviews. Please tell me a place you’d like to chat about!" }.
- If the input is unclear during place selection (e.g., not a number), respond: { "text": "Please choose a number from the list (e.g., '1')." }.
- If a review insight is requested but reviews are still fetching, respond: { "text": "Reviews for [Place Name] are still being fetched. I’ll let you know when they’re ready!" }.

### Available Tools:
${JSON.stringify(
  tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))
)}
`;

    const conversation = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...messages,
    ];

    const result = await reviewModel.generateContent({
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
};

export const fetchPublicReviews = async (placeName: string) => {
  // Placeholder: Simulate reviews from public sites
  return [
    {
      source: "Yelp",
      text: "Great service!",
      rating: 4.0,
      author: "Jane Doe",
      review_date: new Date().toISOString(),
    },
  ];
};
