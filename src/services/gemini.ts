import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { CREDENTIALS } from "../lib/constants";
import type { Tool } from "../types";
import { fetchSimulatedReviewData, summarizeReviewData } from "../lib/helpers";

const GOOGLE_API_KEY = CREDENTIALS.gemini_api_key;

if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const tools: Tool[] = [
  {
    name: "get_review_summary",
    description:
      "Provides an overall summary of reviews for a given product, app, or place. Use this for general questions like 'What do people say about X?' or 'Tell me about X reviews.'",
    parameters: { topic_name: "string" },
    execute: async (params) => {
      const reviews = await fetchSimulatedReviewData(params.topic_name, "all");
      const summary = await summarizeReviewData(
        params.topic_name,
        `Provide a general overview of reviews.`,
        reviews
      );
      return summary;
    },
  },
  {
    name: "get_common_praises",
    description:
      "Extracts common positive feedback or advantages from reviews for a specific product, app, or place. Use this for questions like 'What's good about X?' or 'What do people like about X?'.",
    parameters: { topic_name: "string" },
    execute: async (params) => {
      const reviews = await fetchSimulatedReviewData(params.topic_name, "pros");
      const praises = await summarizeReviewData(
        params.topic_name,
        `What are the most common positive aspects or praises mentioned in reviews?`,
        reviews
      );
      return praises;
    },
  },
  {
    name: "get_common_complaints",
    description:
      "Extracts common negative feedback, issues, or disadvantages from reviews for a specific product, app, or place. Use this for questions like 'What are the common issues with X?' or 'Any problems with X?'.",
    parameters: { topic_name: "string" },
    execute: async (params) => {
      const reviews = await fetchSimulatedReviewData(params.topic_name, "cons");
      const complaints = await summarizeReviewData(
        params.topic_name,
        `What are the most common negative aspects, complaints, or problems mentioned in reviews?`,
        reviews
      );
      return complaints;
    },
  },
  // You can add more tools here, e.g., for comparing products, checking pricing, etc.
];

export { model, safetySettings, tools };
