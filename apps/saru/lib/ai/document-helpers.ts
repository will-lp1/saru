import { generateText, streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export async function createTextDocument({
  title,
  onChunk
}: {
  title: string;
  onChunk?: (accumulatedContent: string) => void
}): Promise<string> {

  if (onChunk) {
    const { textStream } = await streamText({
      model: myProvider.languageModel('chat-model-large'),
      prompt: title,
      system: 'Write in valid Markdown. Only use headings (#, ##), bold and italics and only where appropriate.',
    });

    let accumulatedContent = '';
    for await (const textPart of textStream) {
      accumulatedContent += textPart;
      onChunk(accumulatedContent);
    }
    return accumulatedContent
  }
  else {
    // Non-streaming version (fallback)
    const { text } = await generateText({
      model: myProvider.languageModel('chat-model-large'),
      prompt: title,
      system:
        'Write in valid Markdown. Only use headings (#, ##), bold and italics and only where appropriate.',
    });

    return text;
  }
}

export async function updateTextDocument({
  document,
  description,
}: {
  document: { content: string };
  description: string;
}): Promise<string> {
  const { text } = await generateText({
    model: myProvider.languageModel('artifact-model'),
    system: `
Provide the revised document content in valid Markdown only, using headings (#, ##), bold and italics and only where appropriate.
Do not include any commentary. Never use Tables. 
    `.trim(),
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

  return text;
}