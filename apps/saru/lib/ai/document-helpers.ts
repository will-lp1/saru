import { smoothStream, streamText, type DataStreamWriter } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export async function createTextDocument({
  title,
  dataStream,
}: {
  title: string;
  dataStream: DataStreamWriter;
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
      dataStream.writeData({ type: 'text-delta', content: delta.textDelta });
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
  dataStream: DataStreamWriter;
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
      experimental_providerMetadata: {
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
        const { textDelta } = delta;

        draftContent += textDelta;
        dataStream.writeData({
          type: 'text-delta',
          content: textDelta,
        });
      }
    }

  return draftContent;
}