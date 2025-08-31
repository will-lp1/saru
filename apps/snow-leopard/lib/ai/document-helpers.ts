import { smoothStream, streamText, type UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import { myProvider } from '@/lib/ai/providers';

export async function createTextDocument({
  title,
  dataStream,
}: {
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}) {
  const { fullStream } = streamText({
    model: myProvider.languageModel('chat-model-large'),
    prompt: title,
    system:
      'Write in valid Markdown. Only use headings (#, ##), bold and italics and only where appropriate.',
    experimental_transform: smoothStream({ chunking: 'line' }),
  });

  for await (const delta of fullStream) {
    if (delta.type === 'text-delta') {
      dataStream.write({
        type: 'data-textDelta',
        data: delta.text,
        transient: true,
      });
    }
  }
}

export async function updateTextDocument({
  document,
  description,
  dataStream,
}: {
  document: { content: string };
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}): Promise<string> {
  let draftContent = '';

    const { fullStream } = streamText({
      model: myProvider.languageModel('artifact-model'),
      system: `
Provide the revised document content in valid Markdown only, using headings (#, ##), bold and italics and only where appropriate.
Do not include any commentary. Never use Tables. 
      `.trim(),
      experimental_transform: smoothStream({ chunking: 'line' }),
      prompt: description,
      providerOptions: {
        openai: {
          prediction: {
            type: 'content',
            content: document.content,
          },
        },
      },
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === 'text-delta') {
        const { text } = delta;

        draftContent += text;
        dataStream.write({
          type: 'data-textDelta',
          data: text,
          transient: true,
        });
      }
    }

  return draftContent;
}