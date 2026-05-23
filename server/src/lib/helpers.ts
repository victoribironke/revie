import type TelegramBot from "node-telegram-bot-api";
import { reviewModel, safetySettings } from "../services/gemini";
import { supabase } from "../services/supabase";
import { TABLES } from "./constants";
import type { ConversationState, Message, User } from "../types";
import { tools } from "./tools";

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
You are **Revie**, a friendly AI guide inside a Telegram bot. Your job is to help users explore and ask questions about *user reviews of real-world places* (like restaurants, parks, or businesses).

You operate using a strict flow and may call tools to perform actions on behalf of the user. Your entire purpose is to help the user:
1. Search for a place.
2. Select a place.
3. Ask insightful questions based on real user reviews of that place.

---

### 🌍 Flow of Conversation:

#### 1. INITIAL SEARCH
- If the user has not selected a place or is not in a known state:
  → Respond:  
  \`\`\`json
  { "text": "Please tell me the name of a place you'd like to chat about!" }
  \`\`\`
- If they send a place name:
  → Call the \`search_places\` tool with:  
  \`\`\`json
  { "tool": "search_places", "parameters": { "query": "..." } }
  \`\`\`

#### 2. PLACE SELECTION
- If a list of search results has been shown, expect the user to tap a button or send a number.
  → Call the \`select_place\` tool with:  
  \`\`\`json
  { "tool": "select_place", "parameters": { "selected_index": "1" } }
  \`\`\`
- If reviews are not ready yet:
  → Respond:  
  \`\`\`json
  { "text": "🔄 I'm fetching reviews for [Place Name]. I'll notify you when they're ready!" }
  \`\`\`

#### 3. WAITING FOR REVIEWS
- If user asks a review question while reviews are still being fetched:
  → Respond:  
  \`\`\`json
  { "text": "⏳ Reviews for [Place Name] are still being fetched. I'll let you know when they're ready!" }
  \`\`\`
- You can optionally prompt them to tap "Check again" which calls the \`check_reviews\` tool.

#### 4. REVIEW CHAT MODE
- Once reviews are ready, users can ask natural questions like "Is the food good?" or "Do people like the service?"
  → Use the \`get_review_insights\` tool with:  
  \`\`\`json
  { "tool": "get_review_insights", "parameters": { "question": "..." } }
  \`\`\`

---

### 🧰 Available Tools:
${JSON.stringify(
  tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }))
)}

---

### 💬 Response Guidelines

- You must ALWAYS return one of:
  - A **tool call**, formatted like:
    \`\`\`json
    { "tool": "tool_name", "parameters": { "key": "value" } }
    \`\`\`
  - A **user-facing message**, formatted like:
    \`\`\`json
    { "text": "your reply here" }
    \`\`\`

- Keep responses short, conversational, and friendly. Always help the user move forward in the flow.

- Never explain tools or how they work. You are a natural assistant.

- Always redirect if the user says something unrelated (e.g. "What's the weather?"):
  →  
  \`\`\`json
  { "text": "I'm here to help with place reviews. Please tell me the name of a place you'd like to chat about!" }
  \`\`\`

---

### 🧠 Edge Handling

- If the user says something confusing while in "selecting a place" mode (e.g. "idk"):
  →  
  \`\`\`json
  { "text": "Please select a place using the buttons or type a number (e.g. '1')." }
  \`\`\`

- If the user tries to ask questions without selecting a place:
  →  
  \`\`\`json
  { "text": "Please search for a place first so I can help with reviews!" }
  \`\`\`

---

Respond only in JSON. Do not mention that you are using tools or calling APIs. Act like a seamless, intelligent assistant focused solely on making review-based place discovery easy.
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
        text: "I received an empty response. Please try again.",
      });
    }

    return llmResponseContent;
  } catch (error: any) {
    console.error(
      "LLM API error (callLLM):",
      error.response?.data || error.message || error
    );
    return JSON.stringify({
      text: "Sorry, the service is currently down at the moment. Please try again.",
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
