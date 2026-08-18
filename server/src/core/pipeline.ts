import {
  findPlaces,
  findRecommendations,
  getReviews,
  getFilteredReviews,
} from "../services/serpapi.js";
import { chatCompletion, extractKnowledgeProfile } from "../services/llm.js";
import { searchWebForPlace } from "../services/tavily.js";
import { saveSession } from "../services/supabase.js";
import { trackEvent } from "../services/analytics.js";
import { PROMPTS } from "./prompts.js";
import {
  sendMessage,
  sendMessageWithKeyboard,
  editMessage,
  escapeHtml,
} from "../bot/sender.js";
import type { Session, Place, Message, InlineButton } from "../types.js";

// ─── Recommendations ─────────────────────────────────────────────

export const recommendPlaces = async (
  chatId: number,
  query: string,
  criteria?: string,
) => {
  // Step 1: Send progressive status message
  const statusMsg = await sendMessage(
    chatId,
    `🔍 Finding top recommendations for "<b>${escapeHtml(query)}</b>"...`,
  );
  const statusMsgId = statusMsg?.message_id;

  try {
    // Step 2: Fetch recommendations from SerpAPI
    const places = await findRecommendations(query);
    trackEvent(chatId, "recommendation", {
      query,
      criteria,
      results: places.length,
    });

    if (places.length === 0) {
      const notFoundText = `I couldn't find good recommendations for "<b>${escapeHtml(query)}</b>". Try adding a city or area — for example, <i>"cafes in Victoria Island Lagos"</i>.`;
      if (statusMsgId) {
        await editMessage(chatId, statusMsgId, notFoundText);
      } else {
        await sendMessage(chatId, notFoundText);
      }
      return;
    }

    // Step 3: Format recommendation card and keyboard
    const card = formatRecommendationCard(query, places, criteria);
    const keyboard = formatRecommendationKeyboard(places);

    // Save session with RECOMMENDING state and pending places
    await saveSession({
      chat_id: chatId,
      state: "RECOMMENDING",
      current_place: null,
      knowledge_profile: null,
      messages: [],
      pending_places: places,
      recommendation_query: query,
    });

    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, card, keyboard);
    } else {
      await sendMessageWithKeyboard(chatId, card, keyboard);
    }
  } catch (error) {
    console.error("recommendPlaces error:", error);
    const errorText =
      "Something went wrong while finding recommendations. Please try again.";
    if (statusMsgId) {
      await editMessage(chatId, statusMsgId, errorText);
    } else {
      await sendMessage(chatId, errorText);
    }
  }
};

export const showRecommendationList = async (
  chatId: number,
  session: Session,
  messageId?: number,
) => {
  if (!session.pending_places || session.pending_places.length === 0) {
    await sendMessage(
      chatId,
      "No active recommendation list found. Send what you are looking for to get recommendations!",
    );
    return;
  }

  const query = session.recommendation_query || "Recommendations";
  const card = formatRecommendationCard(query, session.pending_places);
  const keyboard = formatRecommendationKeyboard(session.pending_places);

  await saveSession({
    ...session,
    state: "RECOMMENDING",
    current_place: null,
    knowledge_profile: null,
    messages: [],
  });

  if (messageId) {
    await editMessage(chatId, messageId, card, keyboard);
  } else {
    await sendMessageWithKeyboard(chatId, card, keyboard);
  }
};

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
    trackEvent(chatId, "search", { query, results: places.length });

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
      state: "AWAITING_SELECTION",
      current_place: null,
      knowledge_profile: null,
      messages: [],
      pending_places: places,
      recommendation_query: null,
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

// ─── Place Selection (from disambiguation or recommendation buttons) ───────────────

export const handlePlaceSelection = async (
  chatId: number,
  index: number,
  session: Session,
  messageId?: number,
) => {
  const place = session.pending_places?.[index];
  if (!place) return;

  await processPlace(chatId, place, messageId, session);
};

// ─── Process Place (fetch reviews + summarize) ──────────────────

const processPlace = async (
  chatId: number,
  place: Place,
  statusMsgId?: number,
  session?: Session | null,
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

    // Step 2: Fetch reviews and web context
    const [reviews, webContext] = await Promise.all([
      getReviews(place),
      searchWebForPlace(place.name, place.address),
    ]);
    trackEvent(chatId, "place_selected", {
      name: place.name,
      rating: place.rating,
      reviews_found: reviews.length,
    });

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
    const prompt = PROMPTS.initialSummary(place, reviews, webContext);
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
        formattedReviews + (webContext ? `\n\nWeb info:\n${webContext}` : ""),
      );
    } catch (err) {
      console.error(
        "Knowledge profile extraction failed, continuing without it:",
        err,
      );
    }

    const hasRecommendations = Boolean(
      session?.pending_places && session.pending_places.length > 1,
    );

    // Step 6: Save session
    await saveSession({
      chat_id: chatId,
      state: "CHATTING",
      current_place: place,
      knowledge_profile: knowledgeProfile,
      messages: [{ role: "assistant", content: summary }],
      pending_places: session?.pending_places || null,
      recommendation_query: session?.recommendation_query || null,
    });

    // Step 7: Build the Hero Card response
    const heroCard = buildHeroCard(place, summary);
    const heroKeyboard = buildHeroKeyboard(place, hasRecommendations);

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
  trackEvent(chatId, "follow_up", { place: session.current_place?.name });
  let filteredContext = "";
  try {
    const filteredReviews = await getFilteredReviews(
      session.current_place,
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

const formatRecommendationCard = (
  query: string,
  places: Place[],
  criteria?: string,
): string => {
  const lines = [`✨ <b>Top Recommendations for "${escapeHtml(query)}"</b>`];
  if (criteria) {
    lines.push(`<i>Criteria: ${escapeHtml(criteria)}</i>`);
  }
  lines.push("───");

  places.forEach((p, idx) => {
    const stars = "⭐".repeat(
      Math.min(5, Math.max(1, Math.round(p.rating || 0))),
    );
    const metaParts = [];
    if (p.rating > 0) metaParts.push(`${stars} ${p.rating}/5`);
    if (p.reviews_count > 0) metaParts.push(`(${p.reviews_count} reviews)`);
    if (p.category) metaParts.push(escapeHtml(p.category));
    if (p.price) metaParts.push(escapeHtml(p.price));

    lines.push(`<b>${idx + 1}. ${escapeHtml(p.name)}</b>`);
    if (metaParts.length > 0) {
      lines.push(metaParts.join(" • "));
    }
    if (p.address) {
      lines.push(`🗺️ ${escapeHtml(p.address)}`);
    }
    if (p.snippet) {
      lines.push(`<i>${escapeHtml(p.snippet)}</i>`);
    }
    lines.push("");
  });

  lines.push("👇 <i>Tap a place below to see review summaries and chat:</i>");
  return lines.join("\n");
};

const formatRecommendationKeyboard = (places: Place[]): InlineButton[][] => {
  const keyboard: InlineButton[][] = places.map((p, i) => [
    {
      text: `📖 ${p.name} ${p.rating ? `(⭐${p.rating})` : ""}`,
      callback_data: `select_place:${i}`,
    },
  ]);
  keyboard.push([{ text: "❌ Clear", callback_data: "clear_session" }]);
  return keyboard;
};

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

const buildHeroKeyboard = (
  place: Place,
  hasRecommendations = false,
): InlineButton[][] => {
  const pId = place.place_id || place.data_id || "none";
  const keyboard: InlineButton[][] = [
    [
      {
        text: "🍽️ How's the food?",
        callback_data: `ask:${pId}:How is the food quality?`,
      },
      {
        text: "💸 Is it expensive?",
        callback_data: `ask:${pId}:Is it expensive?`,
      },
    ],
    [
      {
        text: "👨‍👩‍👧‍👦 Good for families?",
        callback_data: `ask:${pId}:Is it good for families?`,
      },
      {
        text: "⏰ Best time to go?",
        callback_data: `ask:${pId}:What is the best time to visit?`,
      },
    ],
    [
      ...(place.place_id
        ? [
            {
              text: "🗺️ Open in Google Maps",
              url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`,
            },
          ]
        : []),
    ],
  ];

  const bottomRow: InlineButton[] = [];
  if (hasRecommendations) {
    bottomRow.push({
      text: "⬅️ Back to List",
      callback_data: "back_to_recommendations",
    });
  }
  bottomRow.push({ text: "❌ End Chat", callback_data: "clear_session" });
  keyboard.push(bottomRow);

  return keyboard;
};

const sendChunkedMessage = async (chatId: number, text: string) => {
  const MAX_LEN = 4000;
  for (let i = 0; i < text.length; i += MAX_LEN) {
    await sendMessage(chatId, text.slice(i, i + MAX_LEN));
  }
};
