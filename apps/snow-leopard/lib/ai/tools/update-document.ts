import { tool, type UIMessageStreamWriter } from 'ai';
import type { Session } from '@/lib/auth';
import { z } from 'zod';
import { getDocumentById } from '@/lib/db/queries';
import type { ChatMessage } from '@/lib/types';
import { updateTextDocument } from '@/lib/ai/document-helpers';

interface UpdateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  documentId?: string;
}

export const updateDocument = ({ session: _session, dataStream, documentId: defaultDocumentId }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document based on a description. Returns the original and proposed new content for review.',
    inputSchema: z.object({
      description: z.string(),
    }),
    execute: async ({ description }) => {

      try {
        if (!description.trim()) {
          return { error: 'No update description provided.' };
        }

        const documentId = defaultDocumentId;

        if (!documentId ||
            documentId === 'undefined' ||
            documentId === 'null' ||
            documentId.length < 32) {
          return { error: `Invalid document ID: "${documentId}".` };
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(documentId)) {
          return { error: `Invalid document ID format: "${documentId}".` };
        }

        // --- Fetch Document ---
        const document = await getDocumentById({ id: documentId });
        if (!document) {
          console.error(`[AI Tool] Document not found with ID: ${documentId}`);
          return { error: 'Document not found' };
        }
        const originalContent = document.content || '';

        dataStream.write({
          type: 'data-clear',
          data: null,
          transient: true,
        });

        const updatedContent = await updateTextDocument({
          document: { content: originalContent },
          description,
          dataStream,
        });

        // Ask the client to persist the streamed content to the database
        dataStream.write({ type: 'data-force-save', data: null, transient: true } as any);

        // Mark the tool stream as finished
        dataStream.write({ type: 'data-finish', data: null, transient: true } as any);

        return {
          id: documentId,
          title: document.title,
          originalContent: originalContent,
          newContent: updatedContent,
          status: 'Update proposal generated.',
        };

      } catch (error: any) {
        console.error('[AI Tool] updateDocument failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          error: 'Failed to generate document update: ' + errorMessage,
        };
      }
    },
  });
