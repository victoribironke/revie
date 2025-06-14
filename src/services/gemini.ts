import { GoogleGenerativeAI } from "@google/generative-ai";
import { CREDENTIALS } from "../lib/constants";

const GOOGLE_API_KEY = CREDENTIALS.gemini_api_key;

if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

export const getReviewInsight = async (
  topic: string,
  question: string
): Promise<string> => {
  const reviewLLMPrompt = `
        You are an AI assistant tasked with summarizing user reviews.
        Based on the following topic and user's question, provide a concise summary or answer from the perspective of user reviews.
        Focus solely on common sentiments and facts from reviews, do not invent information.
        Be helpful and direct.

        Topic: ${topic}
        User's Question: ${question}

        Example: If topic is "Spotify" and question is "What's good about it?", summarize common positive aspects in reviews (e.g., "People often praise its vast music library, personalized playlists like Discover Weekly, and seamless cross-device syncing.").

        Provide a summary or answer to the user's question:
    `;

  try {
    const result = await model.generateContent(reviewLLMPrompt);
    return result.response.text();
  } catch (llmError) {
    console.error("Error generating review insight with LLM:", llmError);
    return `(Error) I'm having trouble getting detailed insights about "${topic}" right now. Please try a different question or topic.`;
  }
};
