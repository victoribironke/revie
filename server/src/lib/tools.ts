import { embeddingModel, reviewModel } from "../services/gemini";
import { placesClient } from "../services/google-maps";
import { supabase } from "../services/supabase";
import { bot } from "../services/telegram";
import type { Tool } from "../types";
import { TABLES } from "./constants";

const search_places: Tool = {
  name: "search_places",
  description: "Search for places using Google Places API.",
  parameters: { query: "string" },
  execute: async ({ query }, chatId) => {
    try {
      const request = { textQuery: query };

      const [response] = await placesClient.searchText(request, {
        otherArgs: {
          headers: {
            "X-Goog-FieldMask":
              "places.id,places.displayName,places.formattedAddress",
          },
        },
      });

      const results =
        response?.places?.slice(0, 5).map((p, i) => ({
          index: i + 1,
          name: p.displayName?.text || "",
          address: p.formattedAddress || "",
          place_id: p.id || "",
        })) || [];

      if (results.length === 0) {
        return "🔍 I couldn't find any matches. Try a more specific name!";
      }

      await supabase.from(TABLES.conversation_state).upsert({
        chat_id: chatId,
        state: "waiting_for_place_selection",
        context: { search_results: results, query },
        updated_at: new Date().toISOString(),
      });

      await bot.sendMessage(chatId, "Here are some places I found:", {
        reply_markup: {
          inline_keyboard: results.map((p) => [
            {
              text: `${p.index}. ${p.name} – ${p.address}`,
              callback_data: p.index.toString(),
            },
          ]),
        },
      });

      return "✅ I've sent you a list of places to choose from.";
    } catch (err) {
      console.error("Search error:", err);
      return "⚠️ I had trouble searching right now. Please try again shortly.";
    }
  },
};

const select_place: Tool = {
  name: "select_place",
  description: "Select a place from recent search results.",
  parameters: { selected_index: "number" },
  execute: async ({ selected_index }, chatId, user) => {
    const index = parseInt(selected_index) - 1;

    const { data: state } = await supabase
      .from(TABLES.conversation_state)
      .select("context")
      .eq("chat_id", chatId)
      .single();

    const results = state?.context?.search_results;
    if (!results || !results[index]) {
      return "⚠️ That number doesn't match any listed place. Please try again.";
    }

    const selected = results[index];

    // Fetch full details
    const [details] = await placesClient.getPlace(
      {
        name: `places/${selected.place_id}`,
      },
      {
        otherArgs: {
          headers: {
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,reviews,internationalPhoneNumber,websiteUri,rating,userRatingCount",
          },
        },
      }
    );

    const placeName = details.displayName?.text || selected.name;

    // Insert or get from DB
    let { data: placeRecord } = await supabase
      .from(TABLES.places)
      .select("*")
      .eq("place_id", selected.place_id)
      .single();

    if (!placeRecord) {
      const { data } = await supabase
        .from(TABLES.places)
        .insert({
          place_id: selected.place_id,
          name: placeName,
          address: selected.address,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      placeRecord = data;
    }

    const recentEnough =
      placeRecord?.last_fetched_reviews_at &&
      new Date(placeRecord.last_fetched_reviews_at) >
        new Date(Date.now() - 7 * 86400000);

    await supabase
      .from(TABLES.users)
      .update({
        current_place_id: selected.place_id,
        current_place_name: placeName,
      })
      .eq("telegram_user_id", chatId);

    await supabase
      .from(TABLES.conversation_state)
      .update({
        state: recentEnough ? "chatting" : "fetching_reviews",
        context: { selected_place: selected },
        updated_at: new Date().toISOString(),
      })
      .eq("chat_id", chatId);

    if (!recentEnough) {
      // enqueue review fetch job here if needed
      return `🔄 I'm fetching reviews for *${placeName}*. I'll notify you when they're ready!`;
    }

    return `✅ Reviews for *${placeName}* are ready. Ask me anything!`;
  },
};

const get_review_insights: Tool = {
  name: "get_review_insights",
  description: "Answer a user question about the selected place's reviews.",
  parameters: { question: "string" },
  execute: async ({ question }, chatId, user) => {
    if (!user.current_place_id || !user.current_place_name) {
      return "⚠️ Please select a place first before asking questions.";
    }

    const { data: state } = await supabase
      .from(TABLES.conversation_state)
      .select("state")
      .eq("chat_id", chatId)
      .single();

    if (state?.state !== "chatting") {
      return `⏳ Reviews for *${user.current_place_name}* are still being fetched. I'll let you know when they're ready!`;
    }

    const { embedding } = await embeddingModel.embedContent(question);

    const { data: reviews } = await supabase.rpc("match_reviews", {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 10,
      place_id: user.current_place_id,
    });

    if (!reviews?.length) {
      return "🤔 I couldn't find any relevant reviews for that question. Try asking something else!";
    }

    const reviewText = reviews
      .map((r: any) => `Review: ${r.text} (Rating: ${r.rating})`)
      .join("\n");

    const prompt = `
Summarize the following reviews for '${user.current_place_name}' to answer: "${question}". 
Focus on relevant opinions and keep it conversational:
${reviewText}
`;

    const result = await reviewModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    return (
      result.response.text() ||
      "🧠 Sorry, I couldn't summarize that well. Try again!"
    );
  },
};

const check_reviews: Tool = {
  name: "check_reviews",
  description: "Checks if reviews for the selected place are ready yet.",
  parameters: {},
  execute: async (_params, chatId, user) => {
    if (!user.current_place_id || !user.current_place_name) {
      return "You haven't selected a place yet. Try searching for one first.";
    }

    const { data: place } = await supabase
      .from(TABLES.places)
      .select("last_fetched_reviews_at")
      .eq("place_id", user.current_place_id)
      .single();

    const reviewsAreFresh =
      place?.last_fetched_reviews_at &&
      new Date(place.last_fetched_reviews_at) >
        new Date(Date.now() - 7 * 86400000);

    if (reviewsAreFresh) {
      await supabase
        .from(TABLES.conversation_state)
        .update({ state: "chatting", updated_at: new Date().toISOString() })
        .eq("chat_id", chatId);

      return `✅ Reviews for *${user.current_place_name}* are now available. What would you like to know?`;
    }

    return `⏳ I'm still fetching reviews for *${user.current_place_name}*. You can check again later.`;
  },
};

const reset_conversation: Tool = {
  name: "reset_conversation",
  description: "Resets the user's conversation to the initial search state.",
  parameters: {},
  execute: async (_params, chatId) => {
    await supabase.from(TABLES.conversation_state).upsert({
      chat_id: chatId,
      state: "awaiting_search_query",
      context: {},
      updated_at: new Date().toISOString(),
    });

    return "✅ Conversation reset. Tell me the name of a place you'd like to chat about!";
  },
};

export const tools: Tool[] = [
  search_places,
  select_place,
  get_review_insights,
  check_reviews,
  reset_conversation,
];
