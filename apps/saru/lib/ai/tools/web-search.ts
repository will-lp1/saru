import { tool } from 'ai';
import { z } from 'zod';
import type { Session } from '@/lib/auth';

interface WebSearchProps {
  session: Session;
}

export const webSearch = ({ session }: WebSearchProps) =>
  tool({
    description: 'Performs a real-time web search using the Tavily API and returns structured search results.',
    parameters: z.object({
      query: z.string().min(1).describe('The search query.'),
      maxResults: z.number().optional().describe('Maximum number of results to return.'),
      searchDepth: z.enum(['basic', 'advanced']).optional().describe('Depth of the search.'),
      includeAnswer: z.union([z.boolean(), z.literal('basic'), z.literal('advanced')]).optional().describe('Whether to include an AI-generated answer.'),
    }),
    execute: async ({ query, maxResults = 5, searchDepth = 'basic', includeAnswer = false }) => {
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
      const json = await response.json();
      return json;
    },
  }); 