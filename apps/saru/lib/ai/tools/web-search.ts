import { tool } from 'ai';
import { z } from 'zod/v3';
import type { Session } from '@/lib/auth';

interface WebSearchProps {
  session: Session;
}

type WebSearchResultItem = {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  publishedDate?: string;
};

type WebSearchReturn = {
  query: string;
  answer?: string;
  results: WebSearchResultItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' ? v : undefined;
}

function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return typeof v === 'number' ? v : undefined;
}

const searchParameters = z.object({
  query: z.string().min(1).describe('The search query.'),
  maxResults: z.number().optional().describe('Maximum number of results to return.'),
  searchDepth: z.enum(['basic', 'advanced']).optional().describe('Depth of the search.'),
  includeAnswer: z.union([z.boolean(), z.literal('basic'), z.literal('advanced')]).optional().describe('Whether to include an AI-generated answer.'),
});

export const webSearch = ({ session }: WebSearchProps) => {
  const _session = session;
  // First, create the tool without execute
  const baseTool = tool({
    description: 'Performs a real-time web search using the Tavily API and returns structured search results.',
    inputSchema: searchParameters,
  });

  // Then add execute function manually
  return {
    ...baseTool,
    execute: async ({ query, maxResults = 5, searchDepth = 'basic', includeAnswer = false }: z.infer<typeof searchParameters>) => {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error('Web search is not configured. Please contact support.');
      }
      
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: searchDepth,
          include_answer: includeAnswer,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Web search failed: ${response.status} ${errorText}`);
      }
      
      const json: unknown = await response.json();

      const answer =
        isRecord(json) ? getString(json, 'answer') : undefined;

      const rawResults =
        isRecord(json) && Array.isArray(json.results) ? json.results : [];

      const results: WebSearchResultItem[] = [];
      for (const item of rawResults.slice(0, maxResults)) {
        if (!isRecord(item)) continue;
        results.push({
          title: getString(item, 'title'),
          url: getString(item, 'url'),
          content: getString(item, 'content'),
          score: getNumber(item, 'score'),
          publishedDate: getString(item, 'published_date'),
        });
      }

      const payload: WebSearchReturn = { query, answer, results };
      return payload;
    },
  };
};