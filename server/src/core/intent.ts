import { classifyIntent as llmClassify } from "../services/llm.js";
import { PROMPTS } from "./prompts.js";
import type { Intent } from "../types.js";

export const classifyIntent = async (
  message: string,
  hasActiveSession: boolean,
): Promise<Intent> => {
  if (message.startsWith("/")) return "command";
  if (!hasActiveSession) return "new_search";

  const prompt = PROMPTS.classification(message);
  const result = await llmClassify(prompt);

  if (result.includes("new_search")) return "new_search";
  if (result.includes("followup")) return "followup";

  return "new_search"; // Default fallback
};
