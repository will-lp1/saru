import { tool, UIMessageStreamWriter, generateId } from 'ai';
import { z } from 'zod/v3';
import { Session } from '@/lib/auth';
import { createTextDocument } from '@/lib/ai/document-helpers';
import { updateCurrentDocumentVersion } from '@/lib/db/queries';

interface CreateDocumentProps {
  session: Session;
  documentId?: string;
  writer: UIMessageStreamWriter; // Add writer for streaming
}

export const streamingDocument = ({ session, documentId, writer }: CreateDocumentProps) =>
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

        const generatedContent = await createTextDocument({ 
          title,
          onChunk: (accumulatedContent) => {
            if (documentId) {
              writer.write({
                type: 'data-editor',
                id: generateId(),
                data: {
                  action: 'update-content',
                  documentId: documentId,
                  content: accumulatedContent,
                  source: 'ai-tool',
                  markAsAI: true
                }
              })
            }
          }
        });
        console.log("this is generated content from line 45", generatedContent);

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

        if (documentId){
          await updateCurrentDocumentVersion({
            userId: session.user.id,
            documentId: documentId,
            content: generatedContent
          })

          writer.write({
            type: 'data-editor',
            id: generateId(),
            data: {
              action: 'update-content',
              documentId: documentId,
              content: generatedContent,
              source: 'ai-tool',
              markAsAI: true
            }
          })
        }

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