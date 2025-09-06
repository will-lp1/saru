import { tool, generateText, UIMessageStreamWriter, generateId } from 'ai';
import { Session } from '@/lib/auth';
import { z } from 'zod/v3';
import { getDocumentById } from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/providers';

interface UpdateDocumentProps {
  session: Session;
  documentId: string;
  writer: UIMessageStreamWriter; // Add writer for streaming
}

export const updateDocument = ({ 
  session: _session, 
  documentId: defaultDocumentId, 
  writer 
}: UpdateDocumentProps) =>
  tool({
    description: 'Update a document based on a description. Returns the original and proposed new content for review.',
    inputSchema: z.object({
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ description }) => {
      const documentId = defaultDocumentId;
      const statusId = generateId(); // For consistent status updates

      try {
        // Stream initial status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'updating',
            status: 'Starting document update...',
            documentId,
            description
          },
        });

        if (!description.trim()) {
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: 'No update description provided',
              documentId
            },
          });
          return { error: 'No update description provided.' };
        }

        if (!documentId ||
            documentId === 'undefined' ||
            documentId === 'null' ||
            documentId.length < 32) {
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: `Invalid document ID: "${documentId}"`,
              documentId
            },
          });
          return { error: `Invalid document ID: "${documentId}".` };
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(documentId)) {
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: `Invalid document ID format: "${documentId}"`,
              documentId
            },
          });
          return { error: `Invalid document ID format: "${documentId}".` };
        }

        // Stream progress: fetching document
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'fetching',
            status: 'Fetching document...',
            documentId
          },
        });

        // --- Fetch Document ---
        const document = await getDocumentById({ id: documentId });
        if (!document) {
          console.error(`[AI Tool] Document not found with ID: ${documentId}`);
          
          // Stream error status
          writer.write({
            type: 'data-status',
            id: statusId,
            data: {
              type: 'error',
              status: 'Document not found',
              documentId
            },
          });
          return { error: 'Document not found' };
        }

        const originalContent = document.content || '';

        // Stream progress: analyzing content
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'analyzing',
            status: 'Analyzing document content...',
            documentId,
            originalLength: originalContent.length
          },
        });

        // Stream document info
        writer.write({
          type: 'data-document',
          id: generateId(),
          data: {
            type: 'document-loaded',
            documentId,
            title: document.title,
            originalLength: originalContent.length,
            description
          },
        });

        // Stream progress: generating update
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'generating',
            status: 'Generating document update...',
            documentId
          },
        });

        const prompt = `You are an expert editor. Here is the ORIGINAL document:
          ${originalContent}

          INSTRUCTIONS:
          - Make only the minimal changes required to satisfy the description.
          - Keep paragraphs, sentences, and words that do **not** need to change exactly as they are.
          - Do **not** paraphrase or re-flow content unless strictly necessary.
          - Preserve existing formatting and line breaks.
          - Return ONLY the updated document content with no additional commentary or separators.

          EDIT DESCRIPTION: "${description}"
          UPDATED DOCUMENT:`;

        const { text: newContent } = await generateText({
          model: myProvider.languageModel('artifact-model'),
          prompt,
          temperature: 0.2,
        });

        // Stream the generated update
        writer.write({
          type: 'data-document',
          id: generateId(),
          data: {
            type: 'update-generated',
            documentId,
            title: document.title,
            originalContent,
            newContent,
            originalLength: originalContent.length,
            newLength: newContent.length,
            description
          },
        });

        // Stream completion status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'finish',
            status: 'Document update proposal generated successfully',
            documentId,
            changesDetected: originalContent !== newContent
          },
        });

        return {
          id: documentId,
          title: document.title,
          originalContent: originalContent, 
          newContent: newContent,           
          status: 'Update proposal generated.',
        };

      } catch (error: any) {
        // Stream error status
        writer.write({
          type: 'data-status',
          id: statusId,
          data: {
            type: 'error',
            status: `Failed to generate document update: ${error.message || error}`,
            documentId
          },
        });

        console.error('[AI Tool] updateDocument failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          error: 'Failed to generate document update: ' + errorMessage,
        };
      }
    },
  });