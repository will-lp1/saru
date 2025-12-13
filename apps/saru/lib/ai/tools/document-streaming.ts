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
      context: z
        .string()
        .optional()
        .describe(
          'Optional relevant context from the current chat (including prior web search results). Use it to ground the writing.'
        ),
      sources: z
        .array(
          z.object({
            title: z.string().optional(),
            url: z.string().optional(),
            content: z.string().optional(),
          })
        )
        .optional()
        .describe('Optional web sources/snippets to ground the writing.'),
    }),
    execute: async ({ title, context, sources }) => {
      try {
        const targetDocumentId = documentId;
        const contextBlock =
          typeof context === 'string' && context.trim().length > 0
            ? `\n\nCONTEXT (from chat/web search):\n${context.trim()}\n`
            : '';
        const sourcesBlock =
          Array.isArray(sources) && sources.length > 0
            ? `\n\nSOURCES (snippets):\n${sources
                .slice(0, 8)
                .map((s, i) => {
                  const t = s.title ? ` - ${s.title}` : '';
                  const u = s.url ? ` (${s.url})` : '';
                  const c = s.content ? `: ${s.content}` : '';
                  return `${i + 1}.${t}${u}${c}`;
                })
                .join('\n')}\n`
            : '';
        const { fullStream } = streamText({
          model: myProvider.languageModel('artifact-model'),
          system:
            'Respond in clean Markdown using standard paragraphs. Do not insert manual line breaks inside sentences; wrap only with double newlines when you truly need a new paragraph. Avoid lists, tables, or code fences unless the user asks. Include headings only when the user explicitly requests them or the prompt clearly calls for a titled section.' +
            contextBlock +
            sourcesBlock +
            '\nUse the provided context/sources when relevant. If context is missing or insufficient, write conservatively and avoid inventing facts.',
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
      } catch (error: unknown) {
        console.error('[AI Tool] streamingDocument failed:', error);
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate document content: ${msg}`);
      }
    },
  });
