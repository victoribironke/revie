import OpenAI from "openai";
import type { Message } from "../types.js";

const CLASSIFICATION_MODEL = "meta-llama/llama-3.2-3b-instruct:free";
const CHAT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export const classifyIntent = async (prompt: string): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: CLASSIFICATION_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 10,
  });

  return (
    response.choices[0]?.message?.content?.trim().toLowerCase() || "new_search"
  );
};

export const chatCompletion = async (messages: Message[]): Promise<string> => {
  const response = await openai.chat.completions.create({
    model: CHAT_MODEL,
    messages: messages as any,
    temperature: 0.7,
    max_tokens: 500,
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "Sorry, I couldn't generate a response."
  );
};
