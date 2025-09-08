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
      const statusId = generateId(); // For consistent status updates

      try {

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
              })
          }
        });

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
            
        await saveDocument({
          id: newDocumentId,
          title,
          content: generatedContent,
          kind: 'text',
          userId,
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
      
        // Stream completion with full document data
        writer.write({
          type: 'data-status',
          id: statusId,
          data: { 
            type: 'finish', 
            documentId: newDocumentId,
            status: 'Document created successfully'
          },
        });

        return { 
          documentId: newDocumentId,
          title,
          content: generatedContent,
          message: 'New document created successfully'
        };
      } catch (error: any) {
        // Stream error status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: { 
            type: 'error', 
            status: `Failed to create document: ${error.message}` 
          },
        });

        console.error('[AI Tool] Failed to create document:', error);
        throw new Error(`Failed to create document: ${error.message || error}`);
      }
    },
  });