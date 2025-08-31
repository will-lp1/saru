import { generateUUID } from '@/lib/utils';
import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from '@/lib/auth';
import { saveDocument } from '@/lib/db/queries';
import type { ChatMessage } from '@/lib/types';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const createDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Creates a new document record in the database, streams back its ID so the editor can initialize it.',
    inputSchema: z.object({
      title: z.string(),
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

        dataStream.write({
          type: 'data-id',
          data: newDocumentId,
          transient: true,
        });

        dataStream.write({
          type: 'data-title',
          data: title,
          transient: true,
        });

        dataStream.write({
          type: 'data-clear',
          data: null as any,
          transient: true,
        });

        dataStream.write({ type: 'data-finish', data: null, transient: true });

        return {
          id: newDocumentId,
          title,
          content: 'A document was created and is now visible to the user.',
        };
      } catch (error: any) {
        console.error('[AI Tool] Failed to create document:', error);
        throw new Error(`Failed to create document: ${error.message || error}`);
      }
    },
  });
