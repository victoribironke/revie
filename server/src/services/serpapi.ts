import type { Place, Review } from "../types.js";

const SERPAPI_KEY = process.env.SERPAPI_KEY || "";
const SERPAPI_BASE = "https://serpapi.com/search.json";

export const findPlaces = async (query: string): Promise<Place[]> => {
  try {
    const params = new URLSearchParams({
      engine: "google_maps",
      q: query,
      api_key: SERPAPI_KEY,
    });

    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    const response = (await res.json()) as any;

    if (response.place_results) {
      return [
        {
          place_id:
            response.place_results.data_id || response.place_results.place_id,
          name: response.place_results.title,
          address: response.place_results.address || "",
          rating: response.place_results.rating || 0,
          reviews_count: response.place_results.reviews || 0,
        },
      ];
    }

    if (response.local_results && response.local_results.length > 0) {
      return response.local_results.slice(0, 3).map((result: any) => ({
        place_id: result.data_id || result.place_id,
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

/**
 * Fetches up to 20 reviews for a place (unfiltered).
 * Used on initial search to build the knowledge profile.
 */
export const getReviews = async (placeId: string): Promise<Review[]> => {
  try {
    const isDataId = placeId.includes(":");
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      num: "20",
      sort_by: "qualityScore",
      api_key: SERPAPI_KEY,
    });

    if (isDataId) {
      params.append("data_id", placeId);
    } else {
      params.append("place_id", placeId);
    }

    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    const response = (await res.json()) as any;

    if (!response.reviews) return [];

    return response.reviews.map(mapReview);
  } catch (error) {
    console.error("SerpAPI getReviews error:", error);
    throw error;
  }
};

/**
 * Fetches reviews filtered by a keyword query.
 * Used during follow-ups to find reviews specifically relevant to the user's question.
 * Each call costs 1 SerpAPI credit.
 */
export const getFilteredReviews = async (
  placeId: string,
  query: string,
): Promise<Review[]> => {
  try {
    const isDataId = placeId.includes(":");
    const params = new URLSearchParams({
      engine: "google_maps_reviews",
      q: query,
      num: "10",
      api_key: SERPAPI_KEY,
    });

    if (isDataId) {
      params.append("data_id", placeId);
    } else {
      params.append("place_id", placeId);
    }

    const res = await fetch(`${SERPAPI_BASE}?${params}`);
    const response = (await res.json()) as any;

    if (!response.reviews) return [];

    return response.reviews.map(mapReview);
  } catch (error) {
    console.error("SerpAPI getFilteredReviews error:", error);
    // Non-fatal — follow-up can still work with cached knowledge profile
    return [];
  }
};

const mapReview = (rev: any): Review => ({
  author: rev.user?.name || rev.author_name || "Unknown",
  rating: rev.rating || 0,
  date: rev.date || "",
  text: rev.snippet || rev.text || "",
});
