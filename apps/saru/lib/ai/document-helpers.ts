import { generateText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export async function createTextDocument({
  title,
}: {
  title: string;
}): Promise<string> {
  const { text } = await generateText({
    model: myProvider.languageModel('chat-model-large'),
    prompt: title,
    system:
      'Write in valid Markdown. Only use headings (#, ##), bold and italics and only where appropriate.',
  });

  return text;
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