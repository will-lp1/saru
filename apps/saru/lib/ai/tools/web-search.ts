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
        // Stream initial search status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'searching',
            status: `Searching the web for: "${query}"`,
            query,
            maxResults,
            searchDepth
          },
        });

        // Stream search parameters
        writer.write({
          type: 'data-search',
          id: generateId(),
          data: {
            type: 'search-started',
            query,
            maxResults,
            searchDepth,
            includeAnswer
          },
        });

        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: 'Web search is not configured. Please contact support.',
              query
            },
          });
          throw new Error('Web search is not configured. Please contact support.');
        }

        // Stream progress: making API call
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'fetching',
            status: 'Fetching search results from Tavily API...',
            query
          },
        });

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
          
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: `Web search failed: ${response.status} ${errorText}`,
              query,
              httpStatus: response.status
            },
          });
          
          throw new Error(`Web search failed: ${response.status} ${errorText}`);
        }

        // Stream progress: processing results
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'processing',
            status: 'Processing search results...',
            query
          },
        });

        const json = await response.json();

        // Stream the search results
        writer.write({
          type: 'data-search',
          id: generateId(),
          data: {
            type: 'results-found',
            query,
            resultsCount: json.results?.length || 0,
            hasAnswer: !!json.answer,
            searchDepth,
            results: json.results || []
          },
        });

        // Stream answer if available
        if (json.answer) {
          writer.write({
            type: 'data-search',
            id: generateId(),
            data: {
              type: 'answer-generated',
              query,
              answer: json.answer
            },
          });
        }

        // Stream completion status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'finish',
            status: `Web search completed: found ${json.results?.length || 0} results`,
            query,
            resultsCount: json.results?.length || 0
          },
        });

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
        // Stream error status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'error',
            status: `Search failed: ${error.message}`,
            query
          },
        });

        console.error('[AI Tool] webSearch failed:', error);
        throw error;
      }
    },
  });
};