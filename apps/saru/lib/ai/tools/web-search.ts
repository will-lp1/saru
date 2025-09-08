import { tool, UIMessageStreamWriter, generateId } from 'ai';
import { z } from 'zod/v3';
import type { Session } from '@/lib/auth';

interface WebSearchProps {
  session: Session;
  writer: UIMessageStreamWriter; // Add writer for streaming
}

const searchParameters = z.object({
  query: z.string().min(1).describe('The search query.'),
  maxResults: z.number().optional().describe('Maximum number of results to return.'),
  searchDepth: z.enum(['basic', 'advanced']).optional().describe('Depth of the search.'),
  includeAnswer: z.union([z.boolean(), z.literal('basic'), z.literal('advanced')]).optional().describe('Whether to include an AI-generated answer.'),
});

export const webSearch = ({ session, writer }: WebSearchProps) => {
  return tool({
    description: 'Performs a real-time web search using the Tavily API and returns structured search results.',
    inputSchema: searchParameters,
    execute: async ({ 
      query, 
      maxResults = 5, 
      searchDepth = 'basic', 
      includeAnswer = false 
    }: z.infer<typeof searchParameters>) => {
      const statusId = generateId(); // For consistent status updates

      try {
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

        return {
          query,
          results: json.results || [],
          answer: json.answer || null,
          searchDepth,
          maxResults,
          totalResults: json.results?.length || 0,
          message: `Found ${json.results?.length || 0} results for "${query}"`
        };

      } catch (error: any) {

        console.error('[AI Tool] webSearch failed:', error);
        throw error;
      }
    },
  });
};