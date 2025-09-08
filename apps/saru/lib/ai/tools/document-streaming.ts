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

        if (documentId){
          await updateCurrentDocumentVersion({
            userId: session.user.id,
            documentId: documentId,
            content: generatedContent
          })
        }

        return {
          title,
          content: generatedContent,
          action: 'document-generated',
          message: 'Content generation completed.',
        };
      } catch (error: any) {
        console.error('[AI Tool] streamingDocument failed:', error);
        throw new Error(`Failed to generate document content: ${error.message || error}`);
      }
    },
  });