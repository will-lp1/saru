import { DataStreamWriter, tool } from 'ai';
import { z } from 'zod';
import { Session } from '@/lib/auth';
import { createTextDocument } from '@/lib/ai/document-helpers';

interface CreateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
}

export const streamingDocument = ({ dataStream }: CreateDocumentProps) =>
  tool({
    description:
      'Generates content based on a title or prompt and streams it into the active document view. Use this to start writing or add content.',
    parameters: z.object({
      title: z.string().describe('The title or topic to generate content about.'),
    }),
    execute: async ({ title }) => {

      await createTextDocument({
        title,
        dataStream,
      });

      dataStream.writeData({ type: 'force-save', content: '' });
      
      dataStream.writeData({ type: 'finish', content: '' });

      return {
        content: 'Content generation streamed.',
      };
    },
  });
