import { UIMessageStreamWriter, tool, streamText } from 'ai';
import { z } from 'zod/v3';
import { Session } from '@/lib/auth';
import { myProvider } from '@/lib/ai/providers';

interface StreamingDocumentProps {
  session: Session;
  dataStream?: UIMessageStreamWriter;
  documentId?: string;
}

export const streamingDocument = ({ session, dataStream, documentId }: StreamingDocumentProps) =>
  tool({
    description: 'Generates content based on a title or prompt for the active document.',
    inputSchema: z.object({
      title: z.string().describe('The title or topic to generate content about.'),
    }),
    execute: async ({ title }) => {
      try {
        const targetDocumentId = documentId;
        const { fullStream } = streamText({
          model: myProvider.languageModel('artifact-model'),
          system:
            'Respond in clean Markdown using standard paragraphs. Do not insert manual line breaks inside sentences; wrap only with double newlines when you truly need a new paragraph. Avoid lists, tables, or code fences unless the user asks. Include headings only when the user explicitly requests them or the prompt clearly calls for a titled section.',
          prompt: title,
          temperature: 0.4,
        });

        let generatedContent = '';
        for await (const delta of fullStream) {
          if (delta.type === 'text-delta') {
            const textDelta = (delta).text as string;
            generatedContent += textDelta;
            dataStream?.write({
              type: 'data-editor-stream-text',
              data: {
                kind: 'editor-stream-text',
                content: textDelta,
                documentId: targetDocumentId,
              },
            });
          }
        }

        dataStream?.write({
          type: 'data-editor-stream-finish',
          data: { kind: 'editor-stream-finish', documentId: targetDocumentId },
        });

        return {
          title,
          content: generatedContent,
          documentId: targetDocumentId,
          action: 'document-generated',
          message: 'Content generation completed.',
        };
      } catch (error: any) {
        console.error('[AI Tool] streamingDocument failed:', error);
        throw new Error(`Failed to generate document content: ${error.message || error}`);
      }
    },
  });
