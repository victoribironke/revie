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
