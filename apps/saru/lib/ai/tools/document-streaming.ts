import { UIMessageStreamWriter, tool, streamText } from 'ai';
import { z } from 'zod/v3';
import { Session } from '@/lib/auth';
import { myProvider } from '@/lib/ai/providers';

interface CreateDocumentProps {
  session: Session;
  dataStream?: UIMessageStreamWriter;
}

export const streamingDocument = ({ session, dataStream }: CreateDocumentProps) =>
  tool({
    description: 'Generates content based on a title or prompt for the active document.',
    inputSchema: z.object({
      title: z.string().describe('The title or topic to generate content about.'),
    }),
    execute: async ({ title }) => {
      try {
        const { fullStream } = streamText({
          model: myProvider.languageModel('artifact-model'),
          system: 'Write valid Markdown. Use headings and emphasis appropriately. No extraneous commentary.',
          prompt: title,
          temperature: 0.4,
        });

        let generatedContent = '';
        for await (const delta of fullStream) {
          if (delta.type === 'text-delta') {
            const textDelta = (delta as any).text as string;
            generatedContent += textDelta;
            // Use data-* events so onData receives them
            dataStream?.write({
              type: 'data-editor-stream-text',
              data: {
                kind: 'editor-stream-text',
                content: textDelta,
              },
            });

            // Also emit artifact-compatible event for markdown streaming
            dataStream?.write({
              type: 'data-editor-stream-artifact',
              data: {
                kind: 'artifact',
                name: 'markdown',
                delta: textDelta,
              },
            });
          }
        }

        // Signal finish so the editor can optionally auto-save
        dataStream?.write({
          type: 'data-editor-stream-finish',
          data: { kind: 'editor-stream-finish' },
        });

        return {
          title,
          content: generatedContent,
          action: 'document-generated',
          message: 'Content generation completed.',
        };
      } catch (error: any) {
        console.error('[AI Tool] streamingDocument failed:', error);
        throw new Error(`Failed to generate document content: ${error.message || error}`);
      }
    },
  });
