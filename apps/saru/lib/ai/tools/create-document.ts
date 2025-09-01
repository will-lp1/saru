import { DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import { Session } from '@/lib/auth';
import { saveDocument } from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Creates a new document record in the database, streams back its ID so the editor can initialize it.',
    parameters: z.object({
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

        // Stream the new ID to the client
        dataStream.writeData({ type: 'id', content: newDocumentId });
        // Delay to allow page navigation and editor initialization
        await new Promise((resolve) => setTimeout(resolve, 4500));
        // Signal that creation is finished
        dataStream.writeData({ type: 'finish', content: '' });

        return { content: 'New document created.' };
      } catch (error: any) {
        console.error('[AI Tool] Failed to create document:', error);
        throw new Error(`Failed to create document: ${error.message || error}`);
      }
    },
  });
