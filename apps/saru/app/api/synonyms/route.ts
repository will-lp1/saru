import { NextResponse } from 'next/server';
import { generateText } from 'ai'; // Using generateText for a non-streaming response
import { myProvider } from '@/lib/ai/providers'; // Assuming myProvider is configured

export async function POST(request: Request) {
  try {
    const { word, context } = await request.json();

    if (!word) {
      return NextResponse.json({ error: 'Missing word parameter' }, { status: 400 });
    }

    const prompt = context
      ? `Given the following text context: "${context}"\n\nProvide exactly two common synonyms for the word "${word}" that fit well within that context. Separate the synonyms with a comma. Do not include the original word. Only output the synonyms. Example: joyful, cheerful`
      : `Provide exactly two common synonyms for the word "${word}". Separate the synonyms with a comma. Do not include the original word. Only output the synonyms. Example: happy -> joyful, cheerful`;

    const { text } = await generateText({
      model: myProvider.languageModel('artifact-model'),
      prompt,
      maxTokens: 20,
      temperature: 0.3,
    });

    const synonyms = text.split(',')
      .map(s => s.trim())
      .filter(s => s !== '' && s.toLowerCase() !== word.toLowerCase())
      .slice(0, 2);

    return NextResponse.json({ synonyms });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
         return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to fetch synonyms' }, { status: 500 });
  }
} 