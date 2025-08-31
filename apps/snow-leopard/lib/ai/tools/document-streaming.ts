import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from '@/lib/auth';
import { createTextDocument } from '@/lib/ai/document-helpers';
import type { ChatMessage } from '@/lib/types';

interface CreateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const streamingDocument = ({ dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Generates content based on a title or prompt and streams it into the active document view. Use this to start writing or add content.',
    inputSchema: z.object({
      title: z.string().describe('The title or topic to generate content about.'),
    }),
    execute: async ({ title }) => {

      await createTextDocument({
        title,
        dataStream,
      });

      dataStream.write({
        type: 'data-appendMessage',
        data: '',
        transient: true,
      });

      dataStream.write({
        type: 'data-force-save' as any,
        data: null as any,
        transient: true,
      });

      dataStream.write({
        type: 'data-finish',
        data: null,
        transient: true,
      });

      return {
        content: 'Content generation streamed.',
      };
    },
  });
