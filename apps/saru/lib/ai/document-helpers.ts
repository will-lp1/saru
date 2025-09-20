import { generateText } from 'ai';
import { myProvider } from '@/lib/ai/providers';

export function dispatchEditorStreamText({
  documentId,
  content,
}: {
  documentId: string;
  content: string;
}) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('editor:stream-text', {
        detail: { documentId, content },
      }),
    );
  } catch {
  }
}

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
