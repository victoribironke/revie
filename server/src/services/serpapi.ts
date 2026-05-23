import { getJson } from "serpapi";
import type { Place, Review } from "../types.js";
import dotenv from "dotenv";

dotenv.config();

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

export const findPlaces = async (query: string): Promise<Place[]> => {
  try {
    const response = await getJson({
      engine: "google_maps",
      q: query,
      api_key: SERPAPI_KEY,
    });

    if (response.place_results) {
      return [
        {
          place_id: response.place_results.place_id,
          name: response.place_results.title,
          address: response.place_results.address || "",
          rating: response.place_results.rating || 0,
          reviews_count: response.place_results.reviews || 0,
        },
      ];
    }

    if (response.local_results && response.local_results.length > 0) {
      return response.local_results.slice(0, 3).map((result: any) => ({
        place_id: result.place_id,
        name: result.title,
        address: result.address || "",
        rating: result.rating || 0,
        reviews_count: result.reviews || 0,
      }));
    }

    return [];
  } catch (error) {
    console.error("SerpAPI findPlaces error:", error);
    throw error;
  }
};

export const getReviews = async (placeId: string): Promise<Review[]> => {
  try {
    const response = await getJson({
      engine: "google_maps_reviews",
      place_id: placeId,
      api_key: SERPAPI_KEY,
    });

    if (!response.reviews) return [];

    return response.reviews.map((rev: any) => ({
      author: rev.user?.name || rev.author_name || "Unknown",
      rating: rev.rating || 0,
      date: rev.date || "",
      text: rev.snippet || rev.text || "",
    }));
  } catch (error) {
    console.error("SerpAPI getReviews error:", error);
    throw error;
  }
};
