import type { Place, Review } from "../types.js";

export const PROMPTS = {
  initialSummary: (
    place: Place,
    reviews: Review[],
    webContext: string = "",
  ) => {
    const formattedReviews = reviews
      .map((r) => `⭐${r.rating} — ${r.text}`)
      .join("\n");

    let context = formattedReviews;
    if (webContext) {
      context += `\n\nAdditionally, here is some information found from across the web (social media, websites):\n${webContext}`;
    }

    return {
      system: `You are a helpful assistant that summarizes Google Maps reviews and web context.
Format your response as a structured summary:

1. Start with a one-line verdict — the overall vibe of the place.
2. List key Pros (things people love) as bullet points.
3. List key Cons (common complaints) as bullet points.
4. End with a brief note about what type of person or occasion this place is best for.

Rules:
- Keep it concise (under 200 words).
- Be honest and balanced — mention both positives and negatives.
- Do NOT invent information not present in the reviews.
- Use plain text only. No markdown, no asterisks, no special formatting.
- Use simple dashes (-) for bullet points.`,
      user: `Here is the information for ${place.name} (${place.address}), rated ${place.rating}/5:

${context}

Summarize what people are saying about this place.`,
    };
  },

  followUpSystem: (place: Place, knowledgeProfile: string) => {
    return `You are a helpful assistant answering questions about ${place.name} (${place.address}).
Here is a structured profile extracted from real Google Maps reviews:

${knowledgeProfile}

Rules:
- Answer questions based ONLY on what the reviews say.
- If the reviews don't cover what the user is asking, say so honestly.
- Use plain text only. No markdown, no asterisks, no special formatting.
- Keep responses concise and conversational.`;
  },

  followUpSystemWithReviews: (place: Place, reviews: Review[]) => {
    const formattedReviews = reviews
      .map((r) => `⭐${r.rating} — ${r.text}`)
      .join("\n");

    return `You are a helpful assistant answering questions about ${place.name} (${place.address}).
Here are the reviews you have access to:

${formattedReviews}

Rules:
- Answer questions based ONLY on what the reviews say.
- If the reviews don't cover what the user is asking, say so honestly.
- Use plain text only. No markdown, no asterisks, no special formatting.
- Keep responses concise and conversational.`;
  },
};
