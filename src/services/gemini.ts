import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { CREDENTIALS } from "../lib/constants";

const GOOGLE_API_KEY = CREDENTIALS.gemini_api_key;

if (!GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const reviewModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

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

export { reviewModel, embeddingModel, safetySettings };
