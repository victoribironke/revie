import OpenAI from "openai";
import type { Message } from "../types.js";

const CHAT_MODEL = "llama-3.3-70b-versatile";

const openai = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY || "",
  maxRetries: 3,
});

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

export const classifyIntent = async (
  text: string,
): Promise<{
  intent: "greeting" | "search_place" | "follow_up_question";
  refinedQuery?: string;
}> => {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `Classify the user's message into one of three categories: "greeting", "search_place", or "follow_up_question". 
- If it's a greeting like "hi", "hello", "hey", classify as "greeting".
- If it seems like the user is asking a question about a place they are currently viewing (e.g., "is it expensive?", "what's the menu?", "how's the vibe"), classify as "follow_up_question".
- If it's a new place they want to look up (e.g., "terra kulture", "Mama Igbeji places", "find me a good cafe"), classify as "search_place".
Return a JSON object with the "intent" string. If the intent is "search_place", also include a "refinedQuery" string that extracts just the name of the place to search for. Return ONLY valid JSON.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  try {
    const res = JSON.parse(response.choices[0]?.message?.content || "{}");
    return {
      intent: res.intent || "search_place",
      refinedQuery: res.refinedQuery || text,
    };
  } catch (e) {
    return { intent: "search_place", refinedQuery: text };
  }
};

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
