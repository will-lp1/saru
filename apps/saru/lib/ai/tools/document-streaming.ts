import { tool, UIMessageStreamWriter, generateId } from 'ai';
import { z } from 'zod/v3';
import { Session } from '@/lib/auth';
import { createTextDocument } from '@/lib/ai/document-helpers';

interface CreateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter; // Add writer for streaming
}

export const streamingDocument = ({ session, writer }: CreateDocumentProps) =>
  tool({
    description: 'Generates content based on a title or prompt for the active document.',
    inputSchema: z.object({
      title: z.string().describe('The title or topic to generate content about.'),
    }),
    execute: async ({ title }) => {
      const statusId = generateId(); // For consistent status updates

      try {
        // Stream initial status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'generating',
            status: `Generating content for: "${title}"`,
            title
          },
        });

        // Stream progress update
        writer.write({
          type: 'data-document',
          id: generateId(),
          data: {
            type: 'content-generating',
            title,
            status: 'Creating document content...'
          },
        });

        const generatedContent = await createTextDocument({ title });

        // Stream the generated content immediately
        writer.write({
          type: 'data-document',
          id: generateId(),
          data: {
            type: 'content-generated',
            title,
            content: generatedContent,
            action: 'document-generated'
          },
        });

        // Stream completion status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'finish',
            status: 'Content generation completed successfully',
            title
          },
        });

        return {
          title,
          content: generatedContent,
          action: 'document-generated',
          message: 'Content generation completed.',
        };
      } catch (error: any) {
        // Stream error status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'error',
            status: `Failed to generate content: ${error.message}`,
            title
          },
        });

        console.error('[AI Tool] streamingDocument failed:', error);
        throw new Error(`Failed to generate document content: ${error.message || error}`);
      }
    },
  });