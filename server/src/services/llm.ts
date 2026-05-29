import OpenAI from "openai";
import type { Message } from "../types.js";

const CHAT_MODEL = "llama-3.3-70b-versatile";

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "",
  maxRetries: 3,
});

// ─── Tool Definitions ───────────────────────────────────────────

const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_place",
      description:
        "Search for a restaurant, cafe, hotel, or other place on Google Maps to get its reviews and information. Use this when the user wants to look up a specific place or find places matching a description.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The name or description of the place to search for (e.g. 'Terra Kulture Lagos', 'best pizza in Lekki')",
          },
        },
        required: ["query"],
      },
    },
  },
];

// ─── Tool-Calling Chat ─────────────────────────────────────────

/**
 * Parse Llama's raw function call format when Groq fails to parse it.
 * Handles formats like:
 *   <function=search_place {"query": "Nike Art Gallery in Lagos"} </function>
 *   <function=search_place{"query": "Nike Art Gallery in Lagos"}</function>
 */
const parseFailedGeneration = (
  text: string,
): { name: string; args: Record<string, any> } | null => {
  const match = text.match(/<function=(\w+)\s*(\{.*?\})\s*<\/function>/s);
  if (!match || !match[1] || !match[2]) return null;

  try {
    const args = JSON.parse(match[2]);
    return { name: match[1], args };
  } catch {
    return null;
  }
};

/**
 * Send messages to the LLM with tool definitions.
 * Handles the tool-call loop: if the LLM calls a tool, we execute it
 * via the provided callback, feed the result back, and repeat until
 * the LLM returns a final text response.
 *
 * @param messages - Conversation messages (system + history + user)
 * @param onToolCall - Callback to execute a tool call. Returns a string result.
 * @param maxIterations - Safety cap on tool call rounds (default 3)
 * @returns The LLM's final text response
 */
export const chatWithTools = async (
  messages: Message[],
  onToolCall: (name: string, args: Record<string, any>) => Promise<string>,
  maxIterations = 3,
): Promise<string> => {
  // Work with a mutable copy so we can append tool results
  const conversationMessages = [...messages];

  for (let i = 0; i < maxIterations; i++) {
    let response;
    try {
      response = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: conversationMessages as any,
        tools: TOOL_DEFINITIONS,
        temperature: 0.7,
        max_tokens: 600,
      });
    } catch (err: any) {
      // Handle Groq/Llama tool_use_failed error — the model outputs tool calls
      // in raw Llama format (<function=name {args} </function>) instead of
      // structured JSON. Parse the failed_generation and execute the tool directly.
      if (
        err?.error?.code === "tool_use_failed" &&
        err?.error?.failed_generation
      ) {
        const parsed = parseFailedGeneration(err.error.failed_generation);
        if (parsed) {
          try {
            await onToolCall(parsed.name, parsed.args);
            return ""; // Tool was executed (e.g. newSearch sent its own messages)
          } catch (toolErr) {
            return "Sorry, I ran into an issue while searching. Please try again.";
          }
        }
      }
      // If we can't parse the failed generation, retry without tools
      const fallbackResponse = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: conversationMessages as any,
        temperature: 0.7,
        max_tokens: 600,
      });
      return (
        fallbackResponse.choices[0]?.message?.content?.trim() ||
        "Sorry, I couldn't generate a response."
      );
    }

    const choice = response.choices[0];
    if (!choice) {
      return "Sorry, I couldn't generate a response.";
    }

    const assistantMessage = choice.message;

    // If no tool calls, we have our final text response
    if (
      !assistantMessage.tool_calls ||
      assistantMessage.tool_calls.length === 0
    ) {
      return (
        assistantMessage.content?.trim() ||
        "Sorry, I couldn't generate a response."
      );
    }

    // Append the assistant's tool-call message to the conversation
    conversationMessages.push({
      role: "assistant",
      content: assistantMessage.content || null,
      tool_calls: assistantMessage.tool_calls,
    });

    // Execute each tool call and append results
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let functionArgs: Record<string, any>;
      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        functionArgs = {};
      }

      let result: string;
      try {
        result = await onToolCall(functionName, functionArgs);
      } catch (err) {
        result = `Error executing ${functionName}: ${err instanceof Error ? err.message : "Unknown error"}`;
      }

      conversationMessages.push({
        role: "tool",
        content: result,
        tool_call_id: toolCall.id,
      });
    }
  }

  // If we exhausted iterations, make one final call without tools to get a response
  const finalResponse = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: conversationMessages as any,
    temperature: 0.7,
    max_tokens: 600,
  });

  return (
    finalResponse.choices[0]?.message?.content?.trim() ||
    "Sorry, I couldn't generate a response."
  );
};

// ─── Standard Chat Completion (for summaries, etc.) ─────────────

export const chatCompletion = async (messages: Message[]): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 600,
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "Sorry, I couldn't generate a response."
  );
};

// ─── Knowledge Profile Extraction ───────────────────────────────

export const extractKnowledgeProfile = async (
  placeName: string,
  reviews: string,
): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `Extract a structured JSON profile from these Google Maps reviews for "${placeName}".
Include ONLY fields that are actually mentioned in the reviews. Possible fields:
cuisine_type, price_range, ambiance, best_for, common_pros (array), common_cons (array),
parking, wifi, accessibility, peak_hours, notable_dishes, service_quality.
Return ONLY valid JSON, no other text.`,
      },
      {
        role: "user",
        content: reviews,
      },
    ],
    temperature: 0,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content?.trim() || "{}";
};

// ─── URL Place Extraction ───────────────────────────────────────

export const extractPlaceFromUrl = async (
  url: string,
): Promise<string | null> => {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : url;

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Extract the name of the restaurant or place from the provided webpage title. Return ONLY the place name. If you cannot find one, just return the title itself.",
        },
        { role: "user", content: `Webpage Title: ${title}\nURL: ${url}` },
      ],
      temperature: 0,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    return null;
  }
};
