import { ENV } from "./env";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
};

export type WebSearchResponse = {
  query: string;
  results: WebSearchResult[];
};

const DEFAULT_SEARCH_DEPTH = "basic";
const DEFAULT_RESULT_LIMIT = 4;

export async function searchWeb(
  query: string,
  options?: { maxResults?: number; searchDepth?: "basic" | "advanced" },
): Promise<WebSearchResponse> {
  if (!ENV.tavilyApiKey) {
    return { query, results: [] };
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.tavilyApiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: options?.maxResults ?? DEFAULT_RESULT_LIMIT,
      search_depth: options?.searchDepth ?? DEFAULT_SEARCH_DEPTH,
      include_answer: false,
      include_images: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Web search failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return {
    query,
    results:
      data.results?.map((item) => ({
        title: item.title ?? "Untitled",
        url: item.url ?? "",
        content: item.content ?? "",
      })) ?? [],
  };
}
