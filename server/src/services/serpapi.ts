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
      const place: Place = {
        data_id: response.place_results.data_id || undefined,
        place_id: response.place_results.place_id || undefined,
        name: response.place_results.title,
        address: response.place_results.address || "",
        rating: response.place_results.rating || 0,
        reviews_count: response.place_results.reviews || 0,
      };
      console.log("[findPlaces] place_results match:", {
        name: place.name,
        data_id: place.data_id,
        place_id: place.place_id,
      });
      return [place];
    }

    if (response.local_results && response.local_results.length > 0) {
      const places = response.local_results.slice(0, 3).map((result: any) => ({
        data_id: result.data_id || undefined,
        place_id: result.place_id || undefined,
        name: result.title,
        address: result.address || "",
        rating: result.rating || 0,
        reviews_count: result.reviews || 0,
      }));
      console.log(
        "[findPlaces] local_results matches:",
        places.map((p: Place) => ({
          name: p.name,
          data_id: p.data_id,
          place_id: p.place_id,
        })),
      );
      return places;
    }

    console.log("[findPlaces] No results found for query:", query);
    return [];
  } catch (error) {
    console.error("SerpAPI findPlaces error:", error);
    throw error;
  }
};

/**
 * Fetches reviews from SerpAPI using a specific identifier.
 * Returns the raw response for inspection.
 */
const fetchReviewsWithId = async (
  idType: "data_id" | "place_id",
  idValue: string,
  extraParams?: Record<string, string>,
): Promise<{ reviews: Review[]; raw: any }> => {
  const params = new URLSearchParams({
    engine: "google_maps_reviews",
    api_key: SERPAPI_KEY,
    ...extraParams,
  });
  params.append(idType, idValue);

  const res = await fetch(`${SERPAPI_BASE}?${params}`);
  const response = (await res.json()) as any;

  if (!response.reviews || response.reviews.length === 0) {
    return { reviews: [], raw: response };
  }

  return { reviews: response.reviews.map(mapReview), raw: null };
};

/**
 * Fetches up to 20 reviews for a place (unfiltered).
 * Uses data_id first, falls back to place_id if no reviews returned.
 */
export const getReviews = async (place: {
  data_id?: string;
  place_id?: string;
}): Promise<Review[]> => {
  try {
    console.log("[getReviews] Called with:", {
      data_id: place.data_id,
      place_id: place.place_id,
    });

    const reviewParams = { num: "20", sort_by: "qualityScore" };

    // Try data_id first (preferred by SerpAPI for reviews)
    if (place.data_id) {
      console.log("[getReviews] Trying data_id:", place.data_id);
      const result = await fetchReviewsWithId(
        "data_id",
        place.data_id,
        reviewParams,
      );
      if (result.reviews.length > 0) {
        console.log(
          "[getReviews] Got",
          result.reviews.length,
          "reviews via data_id",
        );
        return result.reviews;
      }
      console.log("[getReviews] data_id returned 0 reviews. Raw error info:", {
        error: result.raw?.error,
        search_information: result.raw?.search_information,
      });
    }

    // Fallback to place_id
    if (place.place_id) {
      console.log("[getReviews] Trying place_id:", place.place_id);
      const result = await fetchReviewsWithId(
        "place_id",
        place.place_id,
        reviewParams,
      );
      if (result.reviews.length > 0) {
        console.log(
          "[getReviews] Got",
          result.reviews.length,
          "reviews via place_id",
        );
        return result.reviews;
      }
      console.log(
        "[getReviews] place_id also returned 0 reviews. Raw error info:",
        {
          error: result.raw?.error,
          search_information: result.raw?.search_information,
        },
      );
    }

    if (!place.data_id && !place.place_id) {
      console.log("[getReviews] No identifiers available at all");
    }

    return [];
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
  place: { data_id?: string; place_id?: string },
  query: string,
): Promise<Review[]> => {
  try {
    const reviewParams = { q: query, num: "10" };

    // Try data_id first
    if (place.data_id) {
      const result = await fetchReviewsWithId(
        "data_id",
        place.data_id,
        reviewParams,
      );
      if (result.reviews.length > 0) return result.reviews;
    }

    // Fallback to place_id
    if (place.place_id) {
      const result = await fetchReviewsWithId(
        "place_id",
        place.place_id,
        reviewParams,
      );
      if (result.reviews.length > 0) return result.reviews;
    }

    return [];
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
