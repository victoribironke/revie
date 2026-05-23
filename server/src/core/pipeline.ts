import { findPlaces, getReviews } from "../services/serpapi.js";
import { chatCompletion } from "../services/llm.js";
import { saveSession } from "../services/supabase.js";
import { PROMPTS } from "./prompts.js";
import { sendMessage, sendTyping } from "../bot/sender.js";
import type { Session, Place, Review, Message } from "../types.js";

export const newSearch = async (
  chatId: number,
  query: string,
  session?: Session | null,
) => {
  await sendTyping(chatId);

  if (session?.pending_places && /^\d+$/.test(query)) {
    const index = parseInt(query, 10) - 1;
    if (index >= 0 && index < session.pending_places.length) {
      const selectedPlace = session.pending_places[index];
      if (selectedPlace) {
        return await processPlace(chatId, selectedPlace, session);
      }
    }
  }

  const places = await findPlaces(query);

  if (places.length === 0) {
    await sendMessage(
      chatId,
      "I couldn't find that place. Try adding a city name (e.g. 'Terra Kulture Lagos').",
    );
    return;
  }

  if (
    places.length > 1 &&
    (!places[0] || places[0].name.toLowerCase() !== query.toLowerCase())
  ) {
    let msg = `Found a few places matching "${query}":\n`;
    places.forEach((p, i) => {
      msg += `${i + 1}. ${p.name} — ${p.address}\n`;
    });
    msg += "\nReply with the number of the one you mean.";

    await saveSession({
      chat_id: chatId,
      current_place: null,
      current_reviews: null,
      messages: [],
      pending_places: places,
    });

    await sendMessage(chatId, msg);
    return;
  }

  const place = places[0];
  if (place) {
    await processPlace(chatId, place, session);
  }
};

const processPlace = async (
  chatId: number,
  place: Place,
  session?: Session | null,
) => {
  const reviews = await getReviews(place.place_id);

  if (reviews.length === 0) {
    await sendMessage(chatId, "Found the place but there are no reviews yet.");
    return;
  }

  const promptText = PROMPTS.initial_summary(place, reviews);
  const messages: Message[] = [{ role: "user", content: promptText }];

  const aiResponse = await chatCompletion(messages);

  await saveSession({
    chat_id: chatId,
    current_place: place,
    current_reviews: reviews,
    messages: [{ role: "assistant", content: aiResponse }],
    pending_places: null,
  });

  await sendChunkedMessage(chatId, aiResponse);
};

export const followUp = async (
  chatId: number,
  message: string,
  session: Session,
) => {
  await sendTyping(chatId);

  if (!session.current_place || !session.current_reviews) {
    await sendMessage(
      chatId,
      "I'm not sure which place we're talking about. Try searching for a place first!",
    );
    return;
  }

  const systemPrompt = PROMPTS.follow_up_system(
    session.current_place,
    session.current_reviews,
  );

  const history = session.messages.slice(-19);
  history.push({ role: "user", content: message });

  const aiMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  const aiResponse = await chatCompletion(aiMessages);

  history.push({ role: "assistant", content: aiResponse });

  await saveSession({
    ...session,
    messages: history,
  });

  await sendChunkedMessage(chatId, aiResponse);
};

const sendChunkedMessage = async (chatId: number, text: string) => {
  const MAX_LEN = 4000;
  for (let i = 0; i < text.length; i += MAX_LEN) {
    await sendMessage(chatId, text.slice(i, i + MAX_LEN));
  }
};
