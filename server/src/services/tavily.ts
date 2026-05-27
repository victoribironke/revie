const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const TAVILY_BASE = "https://api.tavily.com/search";

export const searchWebForPlace = async (
  placeName: string,
  location: string,
): Promise<string> => {
  if (!TAVILY_API_KEY) {
    console.warn("TAVILY_API_KEY is not set. Skipping web search.");
    return "";
  }

  try {
    const query = `${placeName} ${location} reviews social media menu`;
    const body = {
      query: query,
      search_depth: "basic",
      include_answer: false,
      include_images: false,
      include_raw_content: false,
      max_results: 3,
    };

    const res = await fetch(TAVILY_BASE, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as any;

    if (data && data.results && data.results.length > 0) {
      return data.results
        .map((r: any) => `Source: ${r.url}\nContent: ${r.content}`)
        .join("\n\n");
    }

    return "";
  } catch (error) {
    console.error("Tavily search error:", error);
    return "";
  }
};
