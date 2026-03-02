import { streamText, smoothStream } from 'ai';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { myProvider } from '@/lib/ai/providers';

export async function POST(request: Request) {
  const { messages, context, title, author, date } = await request.json();

  const systemPrompt = [
    'You are a helpful AI assistant answering reader questions about the following article. Provide concise, accurate answers based on the article content.',
    '',
    `Title: ${title}`,
    `Author: ${author}`,
    `Date: ${date}`,
    '',
    'Article content:',
    context,
  ].join('\n');

  const { fullStream } = streamText({
    model: myProvider.languageModel(DEFAULT_CHAT_MODEL),
    system: systemPrompt,
    messages: messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    })),
    experimental_transform: smoothStream({ chunking: 'word' }),
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        for await (const delta of fullStream) {
          if (delta.type === 'text-delta') {
            controller.enqueue(new TextEncoder().encode(delta.textDelta));
          }
        }
        controller.close();
      }
    }),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}
