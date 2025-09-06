import { UIMessageStreamWriter, tool, generateId } from 'ai';
import { z } from 'zod';
import { Session } from '@/lib/auth';
import { saveDocument, updateCurrentDocumentVersion, getDocumentById } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
import { createTextDocument } from '../document-helpers';

interface CreateDocumentProps {
  session: Session;
  documentId?: string;
  writer: UIMessageStreamWriter; // Make required since you need streaming
}

export const createDocument = ({ session, documentId, writer }: CreateDocumentProps) =>
  tool({
    description:
      'Creates a new document record in the database, streams back its ID so the editor can initialize it.',
    inputSchema: z.object({
      title: z.string().describe('The title for the new document.'),
    }),
    execute: async ({ title }) => {
      const newDocumentId = documentId || generateUUID();
      const userId = session.user.id;
      const statusId = generateId(); // For consistent status updates

      try {
        if (documentId) {
          // Stream status for existing document update
          writer.write({
            type: 'data-status',
            id: statusId,
            data: { 
              type: 'updating', 
              documentId,
              status: 'Updating existing document...' 
            },
          });

          const generatedContent = await createTextDocument({ title });
          
          const result = await updateCurrentDocumentVersion({
            userId: userId,
            documentId: documentId,
            content: generatedContent,
          });

          // Stream the document ID for client-side navigation
          writer.write({
            type: 'data-document',
            id: generateId(),
            data: { 
              type: 'id', 
              content: documentId,
              title,
              action: 'updated'
            },
          });

          writer.write({
            type: 'data-editor',
            id: generateId(),
            data: {
              action: 'update-content',
              documentId: documentId,
              content: generatedContent,
              source: 'ai-tool'
            }
          })

          // Stream completion
          writer.write({
            type: 'data-status',
            id: statusId,
            data: { 
              type: 'finish', 
              documentId,
              status: 'Document updated successfully'
            },
          });

          return {
            documentId: documentId,
            title,
            content: generatedContent,
            message: 'Document updated successfully.',
          };
        }

        // For new documents
        writer.write({
          type: 'data-status',
          id: statusId,
          data: { 
            type: 'creating', 
            status: 'Creating new document...' 
          },
        });

        // Stream the new document ID immediately for client navigation
        writer.write({
          type: 'data-document',
          id: generateId(),
          data: { 
            type: 'id', 
            content: newDocumentId,
            title,
            action: 'created'
          },
        });

        const generatedContent = await createTextDocument({ title });

        await saveDocument({
          id: newDocumentId,
          title,
          content: generatedContent,
          kind: 'text',
          userId,
        });

        // Get the complete document data
        const newDocument = await getDocumentById({ id: newDocumentId });

        writer.write({
          type: 'data-editor',
          id: generateId(),
          data: {
            action: 'update-content',
            documentId: newDocumentId,
            content: generatedContent,
            source: 'ai-tool'
          }
        })

        // Optional delay for UI synchronization (if still needed)
        await new Promise((resolve) => setTimeout(resolve, 1000));

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