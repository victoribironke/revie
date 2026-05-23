import type { Place, Review } from "../types.js";

export const PROMPTS = {
  classification: (message: string) => `System:
You classify user messages in a place-review chatbot.
A session is active (user has already searched for a place).

Respond with ONLY one of:
- "new_search" — user wants to look up a different place
- "followup" — user is asking more about the current place

Message: "${message}"`,

  initial_summary: (place: Place, reviews: Review[]) => {
    const formattedReviews = reviews
      .map((r) => `⭐${r.rating} — ${r.text}`)
      .join("\n");

    return `System:
You are a helpful assistant that gives honest, conversational summaries
of Google Maps reviews. Be balanced — mention both positives and negatives.
Do not invent information not present in the reviews.
Keep responses concise (under 200 words unless asked for more detail).
Format for Telegram: use plain text, avoid markdown symbols that don't render.

User:
Here are the reviews for ${place.name} (${place.address}), rated ${place.rating}/5:

${formattedReviews}

Give a clear summary of what people are saying. Then ask if they want
to know anything specific.`;
  },

  follow_up_system: (place: Place, reviews: Review[]) => {
    const formattedReviews = reviews
      .map((r) => `⭐${r.rating} — ${r.text}`)
      .join("\n");

    return `You are a helpful assistant answering questions about ${place.name} (${place.address}).
Here are the reviews you have access to:

${formattedReviews}

Answer questions based only on what the reviews say.
If the reviews don't cover what the user is asking, say so honestly.
Format for Telegram: plain text only.`;
  },
};
