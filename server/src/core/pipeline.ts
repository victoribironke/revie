import {
  findPlaces,
  getReviews,
  getFilteredReviews,
} from "../services/serpapi.js";
import { chatCompletion, extractKnowledgeProfile } from "../services/llm.js";
import { saveSession } from "../services/supabase.js";
import { PROMPTS } from "./prompts.js";
import {
  sendMessage,
  sendMessageWithKeyboard,
  editMessage,
  escapeHtml,
} from "../bot/sender.js";
import type { Session, Place, Message, InlineButton } from "../types.js";

// ─── New Search ──────────────────────────────────────────────────

export const newSearch = async (chatId: number, query: string) => {
  // Step 1: Send progressive status message
  const statusMsg = await sendMessage(
    chatId,
    `🔍 Searching for "<b>${escapeHtml(query)}</b>"...`,
  );
  const statusMsgId = statusMsg?.message_id;

  try {
    // Step 2: Find places via SerpAPI
    const places = await findPlaces(query);

    if (places.length === 0) {
      const notFoundText =
        'I couldn\'t find that place. Try adding a city name — for example, <i>"Terra Kulture Lagos"</i>.';
      if (statusMsgId) {
        await editMessage(chatId, statusMsgId, notFoundText);
      } else {
        await sendMessage(chatId, notFoundText);
      }
      return;
    }

    // Step 3: Single match → process immediately
    if (
      places.length === 1 ||
      places[0]?.name.toLowerCase() === query.toLowerCase()
    ) {
      const place = places[0];
      if (place) {
        await processPlace(chatId, place, statusMsgId);
      }
      return;
    }

    // Step 4: Multiple matches → show disambiguation with inline buttons
    const keyboard: InlineButton[][] = places.map((p, i) => [
      {
        text: `📍 ${p.name} — ${p.address}`,
        callback_data: `select_place:${i}`,
      },
    ]);

    const disambigText = `I found a few places matching "<b>${escapeHtml(query)}</b>". Which one did you mean?`;

    // Save pending places and set mode
    await saveSession({
      chat_id: chatId,
      mode: "choosing_place",
      current_place: null,
      current_reviews: null,
      knowledge_profile: null,
      messages: [],
      pending_places: places,
    });

    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, disambigText, keyboard);
    } else {
      await sendMessageWithKeyboard(chatId, disambigText, keyboard);
    }
  } catch (error) {
    console.error("newSearch error:", error);
    const errorText = "Something went wrong while searching. Please try again.";
    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, errorText);
    } else {
      await sendMessage(chatId, errorText);
    }
  }
};

// ─── Place Selection (from disambiguation buttons) ───────────────

export const handlePlaceSelection = async (
  chatId: number,
  index: number,
  session: Session,
  messageId?: number,
) => {
  const place = session.pending_places?.[index];
  if (!place) return;

  await processPlace(chatId, place, messageId);
};

// ─── Process Place (fetch reviews + summarize) ──────────────────

const processPlace = async (
  chatId: number,
  place: Place,
  statusMsgId?: number,
) => {
  try {
    // Step 1: Update status
    const reviewStatusText = `📊 Reading reviews for <b>${escapeHtml(place.name)}</b>...`;
    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, reviewStatusText);
    } else {
      const msg = await sendMessage(chatId, reviewStatusText);
      statusMsgId = msg?.message_id;
    }

    // Step 2: Fetch reviews
    const reviews = await getReviews(place.place_id);

    if (reviews.length === 0) {
      const noReviewsText = `Found <b>${escapeHtml(place.name)}</b>, but there are no reviews yet.`;
      if (statusMsgId) {
        await editMessage(chatId, statusMsgId, noReviewsText);
      } else {
        await sendMessage(chatId, noReviewsText);
      }
      return;
    }

    // Step 3: Update status — summarizing
    const summaryStatusText = "💬 Summarizing reviews...";
    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, summaryStatusText);
    }

    // Step 4: Generate summary via LLM
    const prompt = PROMPTS.initialSummary(place, reviews);
    const messages: Message[] = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];
    const summary = await chatCompletion(messages);

    // Step 5: Extract knowledge profile (runs concurrently-ish but we await it)
    const formattedReviews = reviews
      .map((r) => `⭐${r.rating} — ${r.text}`)
      .join("\n");

    let knowledgeProfile: string | null = null;
    try {
      knowledgeProfile = await extractKnowledgeProfile(
        place.name,
        formattedReviews,
      );
    } catch (err) {
      console.error(
        "Knowledge profile extraction failed, continuing without it:",
        err,
      );
    }

    // Step 6: Save session
    await saveSession({
      chat_id: chatId,
      mode: "active_place",
      current_place: place,
      current_reviews: reviews,
      knowledge_profile: knowledgeProfile,
      messages: [{ role: "assistant", content: summary }],
      pending_places: null,
    });

    // Step 7: Build the Hero Card response
    const heroCard = buildHeroCard(place, summary);
    const heroKeyboard = buildHeroKeyboard(place);

    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, heroCard, heroKeyboard);
    } else {
      await sendMessageWithKeyboard(chatId, heroCard, heroKeyboard);
    }
  } catch (error) {
    console.error("processPlace error:", error);
    const errorText =
      "Something went wrong while fetching reviews. Please try again.";
    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, errorText);
    } else {
      await sendMessage(chatId, errorText);
    }
  }
};

// ─── Follow-Up ──────────────────────────────────────────────────

export const followUp = async (
  chatId: number,
  message: string,
  session: Session,
) => {
  if (!session.current_place) {
    await sendMessage(
      chatId,
      "I'm not sure which place we're talking about. Send a place name to start!",
    );
    return;
  }

  // Step 1: Fetch keyword-filtered reviews relevant to the user's question
  let filteredContext = "";
  try {
    const filteredReviews = await getFilteredReviews(
      session.current_place.place_id,
      message,
    );

    if (filteredReviews.length > 0) {
      const formatted = filteredReviews
        .map((r) => `⭐${r.rating} — ${r.text}`)
        .join("\n");
      filteredContext = `\n\nAdditionally, here are reviews specifically matching the user's question:\n${formatted}`;
    }
  } catch (err) {
    console.error("Filtered review fetch failed, continuing without:", err);
  }

  // Step 2: Build system prompt — knowledge profile + filtered reviews
  let systemPrompt: string;
  if (session.knowledge_profile) {
    systemPrompt =
      PROMPTS.followUpSystem(session.current_place, session.knowledge_profile) +
      filteredContext;
  } else if (session.current_reviews) {
    systemPrompt =
      PROMPTS.followUpSystemWithReviews(
        session.current_place,
        session.current_reviews,
      ) + filteredContext;
  } else {
    await sendMessage(
      chatId,
      "I don't have review data for this place anymore. Try searching again!",
    );
    return;
  }

  // Step 3: Build message history (cap at last 19 + new user message = 20)
  const history = session.messages.slice(-19);
  history.push({ role: "user", content: message });

  const aiMessages: Message[] = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  const aiResponse = await chatCompletion(aiMessages);

  // Append assistant response to history
  history.push({ role: "assistant", content: aiResponse });

  // Save updated session
  await saveSession({
    ...session,
    messages: history,
  });

  // Send response (chunked if needed)
  await sendChunkedMessage(chatId, escapeHtml(aiResponse));
};

// ─── Helpers ────────────────────────────────────────────────────

const buildHeroCard = (place: Place, summary: string): string => {
  const ratingStars = "⭐".repeat(Math.round(place.rating));
  const lines = [
    `<b>${escapeHtml(place.name)}</b>`,
    `${ratingStars} ${place.rating}/5 | 🗺️ ${escapeHtml(place.address)}`,
    `───`,
    ``,
    escapeHtml(summary),
    ``,
    `<i>Ask me anything about this place, or type a new place name to search again.</i>`,
  ];
  return lines.join("\n");
};

const buildHeroKeyboard = (place: Place): InlineButton[][] => {
  const keyboard: InlineButton[][] = [
    [
      {
        text: "🍽️ How's the food?",
        callback_data: "ask:How is the food quality?",
      },
      { text: "💸 Is it expensive?", callback_data: "ask:Is it expensive?" },
    ],
    [
      {
        text: "👨‍👩‍👧‍👦 Good for families?",
        callback_data: "ask:Is it good for families?",
      },
      {
        text: "⏰ Best time to go?",
        callback_data: "ask:What is the best time to visit?",
      },
    ],
    [
      {
        text: "🗺️ Open in Google Maps",
        url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
      },
    ],
    [{ text: "❌ End Chat", callback_data: "clear_session" }],
  ];
  return keyboard;
};

const sendChunkedMessage = async (chatId: number, text: string) => {
  const MAX_LEN = 4000;
  for (let i = 0; i < text.length; i += MAX_LEN) {
    await sendMessage(chatId, text.slice(i, i + MAX_LEN));
  }
};
