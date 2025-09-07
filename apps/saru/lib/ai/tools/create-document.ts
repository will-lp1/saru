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
            
        await saveDocument({
          id: newDocumentId,
          title,
          content: '',
          kind: 'text',
          userId,
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
          content: '',
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