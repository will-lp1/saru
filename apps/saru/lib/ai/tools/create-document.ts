import { UIMessageStreamWriter, tool, generateId } from 'ai';
import { z } from 'zod';
import { Session } from '@/lib/auth';
import { saveDocument, updateCurrentDocumentVersion, getDocumentById } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { createTextDocument } from '../document-helpers';

interface CreateDocumentProps {
  session: Session;
  writer: UIMessageStreamWriter; // Make required since you need streaming
}

export const createDocument = ({ session, writer }: CreateDocumentProps) =>
  tool({
    description:
      'Creates a new document record in the database, streams back its ID so the editor can initialize it.',
    inputSchema: z.object({
      title: z.string().describe('The title for the new document.'),
    }),
    execute: async ({ title }) => {
      const newDocumentId = generateUUID();
      const userId = session.user.id;

      try {
        let lastUpdateTime = 0;
        const UPDATE_INTERVAL = 150; // Update every 150ms instead of every chunk

        const generatedContent = await createTextDocument({ 
          title,
          onChunk: (accumulatedContent) => {
            const now = Date.now();
            
            // Only send updates every 150ms to prevent flooding
            if (now - lastUpdateTime >= UPDATE_INTERVAL) {
              writer.write({
                type: 'data-editor',
                id: generateId(),
                data: {
                  action: 'update-content',
                  documentId: newDocumentId,
                  content: accumulatedContent,
                  source: 'ai-tool',
                  markAsAI: true
                }
              });
              lastUpdateTime = now;
            }
          }
        });

        writer.write({
          type: 'data-editor',
          id: generateId(),
          data: {
            action: 'update-content',
            documentId: newDocumentId,
            content: generatedContent,
            source: 'ai-tool',
            markAsAI: true
          }
        });

        await saveDocument({
          id: newDocumentId,
          title,
          content: generatedContent,
          kind: 'text',
          userId,
        });

        return { 
          documentId: newDocumentId,
          title,
          content: generatedContent,
          message: 'New document created successfully'
        };
      } catch (error: any) {
        console.error('[AI Tool] Failed to create document:', error);
        throw new Error(`Failed to create document: ${error.message || error}`);
      }
    },
  });