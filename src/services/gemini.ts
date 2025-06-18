import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";
import { CREDENTIALS, TABLES } from "../lib/constants";
import type { Tool } from "../types";
import { supabase } from "./supabase";
import { placesClient } from "./google-maps";

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

const tools: Tool[] = [
  {
    name: "search_places",
    description:
      "Searches Google Maps for places based on a user’s query. Returns up to 5 places with name, address, and place ID.",
    parameters: { query: "string" },
    execute: async (params, chatId) => {
      try {
        const request = {
          textQuery: params.query,
        };

        const [response] = await placesClient.searchText(request, {
          otherArgs: {
            headers: {
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress",
            },
          },
        });

        const places = response?.places?.slice(0, 10).map((place, index) => ({
          index: index + 1,
          name: place.displayName?.text || "",
          address: place.formattedAddress || "",
          place_id: place.id || "",
        }));

        if (places?.length === 0) {
          return JSON.stringify({ text: "No places found for that query." });
        }

        await supabase
          .from(TABLES.conversation_state)
          .update({
            context: { search_results: places, query: params.query },
            state: "waiting_for_place_selection",
            updated_at: new Date().toISOString(),
          })
          .eq("chat_id", chatId);

        return (
          "Found these places:\n" +
          places
            ?.map((p) => `${p.index}. ${p.name} - ${p.address}`)
            .join("\n") +
          "\nPlease reply with the number of the place you want to chat about (e.g., '1')."
        );
      } catch (error) {
        console.error("Google Maps API error:", error);

        return "Sorry, I couldn’t search for places right now.";
      }
    },
  },
  {
    name: "select_place",
    description:
      "Selects a place from search results by index and checks review status. Initiates review fetching if needed.",
    parameters: { selected_index: "number" },
    execute: async (params, chatId, userRecord) => {
      const { data: state, error } = await supabase
        .from(TABLES.conversation_state)
        .select("context")
        .eq("chat_id", chatId)
        .single();

      if (error || !state?.context?.search_results) {
        return JSON.stringify({
          text: "No search results found. Please start by naming a place.",
        });
      }

      const index = parseInt(params.selected_index) - 1;
      const place = state.context.search_results[index];

      if (!place) {
        return JSON.stringify({
          text: "Invalid selection. Please choose a number from the list.",
        });
      }

      // Fetch place details
      const request = {
        name: `places/${place.place_id}`,
      };

      const [placeDetails] = await placesClient.getPlace(request, {
        otherArgs: {
          headers: {
            "X-Goog-FieldMask":
              "id,displayName,formattedAddress,reviews,internationalPhoneNumber,websiteUri,rating,userRatingCount,priceLevel,openingHours",
          },
        },
      });

      // Check if place exists in database
      let { data: placeRecord, error: placeError } = await supabase
        .from(TABLES.places)
        .select("*")
        .eq("place_id", place.place_id)
        .single();

      if (!placeRecord) {
        const { data: newPlace } = await supabase
          .from(TABLES.places)
          .insert({
            place_id: place.place_id,
            name: placeDetails.displayName?.text || "",
            address: placeDetails.formattedAddress || "",
            created_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        placeRecord = newPlace;
      }

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const reviewsAreFresh =
        placeRecord?.last_fetched_reviews_at &&
        new Date(placeRecord.last_fetched_reviews_at) > sevenDaysAgo;

      // Update user and state
      await supabase
        .from(TABLES.users)
        .update({
          current_place_id: place.place_id,
          current_place_name: placeDetails.name,
          last_fetched_reviews_at: reviewsAreFresh
            ? placeRecord.last_fetched_reviews_at
            : new Date().toISOString(),
        })
        .eq("telegram_user_id", chatId);

      await supabase
        .from(TABLES.conversation_state)
        .update({
          context: { selected_place: placeDetails, query: state.context.query },
          state: reviewsAreFresh ? "chatting" : "fetching_reviews",
          updated_at: new Date().toISOString(),
        })
        .eq("chat_id", chatId);

      if (!reviewsAreFresh) {
        // Enqueue review fetching job
        // await reviewQueue.add("fetch-reviews", {
        //   place_id: place.place_id,
        //   place_name: placeDetails.name,
        //   chat_id: chatId,
        // });
        return `I'm fetching reviews for ${placeDetails.displayName}. I’ll notify you when they’re ready!`;
      }

      return `The reviews for ${placeDetails.name} are ready. What would you like to know?`;
    },
  },
  {
    name: "get_review_insights",
    description:
      "Answers user questions about reviews for the selected place using stored review data.",
    parameters: { question: "string" },
    execute: async (params, chatId, userRecord) => {
      if (!userRecord.current_place_id || !userRecord.current_place_name) {
        return JSON.stringify({
          text: "No place selected yet. Please search for a place first.",
        });
      }
      const { data: state } = await supabase
        .from(TABLES.conversation_state)
        .select("state")
        .eq("chat_id", chatId)
        .single();
      if (state?.state === "fetching_reviews") {
        return JSON.stringify({
          text: `Reviews for ${userRecord.current_place_name} are still being fetched. I’ll let you know when they’re ready!`,
        });
      }

      // Generate embedding for the question
      const { embedding } = await embeddingModel.embedContent(params.question);

      // Perform vector similarity search
      const { data: reviews } = await supabase.rpc("match_reviews", {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: 10,
        place_id: userRecord.current_place_id,
      });

      if (!reviews || reviews.length === 0) {
        return JSON.stringify({
          text: `No relevant reviews found for ${userRecord.current_place_name}. Try a different question!`,
        });
      }

      // Summarize reviews with Gemini
      const reviewText = reviews
        .map((r: any) => `Review: ${r.text} (Rating: ${r.rating})`)
        .join("\n");

      const prompt = `
        Summarize the following reviews for '${userRecord.current_place_name}' to answer: "${params.question}".
        Be concise and focus on relevant sentiments and facts.
        Reviews:
        ${reviewText}
      `;

      const result = await reviewModel.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      return result.response.text();
    },
  },
];

export { reviewModel, embeddingModel, safetySettings, tools };
