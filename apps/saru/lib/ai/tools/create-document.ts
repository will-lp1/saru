import { UIMessageStreamWriter, tool } from 'ai';
import { z } from 'zod/v3';
import { Session } from '@/lib/auth';
import { saveDocument } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

interface CreateDocumentProps {
  session: Session;
}

export const createDocument = ({ session }: CreateDocumentProps) =>
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
        await saveDocument({
          id: newDocumentId,
          title,
          content: '',
          kind: 'text',
          userId,
        });

        return { 
          documentId: newDocumentId,
          title,
          message: 'New document created successfully'
        };
      } catch (error: unknown) {
        console.error('[AI Tool] Failed to create document:', error);
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to create document: ${msg}`);
      }
    },
  });