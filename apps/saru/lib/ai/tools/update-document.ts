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

      try {

        if (!description.trim()) {
          return { error: 'No update description provided.' };
        }

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

        const { text: newContent } = await generateText({
          model: myProvider.languageModel('artifact-model'),
          system: `You are an expert document editor. You provide only the revised document content in valid Markdown format. Never include commentary, explanations, or separators. Use headings (#, ##), bold, and italics appropriately. Never use tables.`,
          
          prompt: `Original document:
        ${originalContent}

        Edit requirements:
        - Make only minimal changes needed for: "${description}"
        - Preserve unchanged content exactly as-is
        - Do not paraphrase unless required
        - Maintain existing formatting and line breaks

        Return the updated document:`,
          
          temperature: 0.2,
        });

        return {
          id: documentId,
          title: document.title,
          originalContent: originalContent, 
          newContent: newContent,           
          status: 'Update proposal generated.',
        };

      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          error: 'Failed to generate document update: ' + errorMessage,
        };
      }
    },
  });