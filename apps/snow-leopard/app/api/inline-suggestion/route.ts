import { NextResponse, NextRequest } from 'next/server';
import { streamText } from 'ai';
import { myProvider } from '@/lib/ai/providers';
import { getSessionCookie } from 'better-auth/cookies';

async function handleInlineSuggestionRequest(
  contextBefore: string,
  contextAfter: string,
  fullContent: string,
  suggestionLength: 'short' | 'medium' | 'long' = 'medium',
  customInstructions?: string | null,
  writingStyleSummary?: string | null,
  applyStyle: boolean = true
) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  let writerClosed = false;

  (async () => {
    try {
      console.log("Starting to process inline suggestion stream");

      await streamInlineSuggestion({ contextBefore, contextAfter, fullContent, suggestionLength, customInstructions, writingStyleSummary, applyStyle, write: async (type, content) => {
        if (writerClosed) return;

        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type,
            content
          })}\n\n`));
        } catch (error) {
          console.error('Error writing to stream:', error);
        }
      } });

      if (!writerClosed) {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'finish',
            content: ''
          })}\n\n`));
        } catch (error) {
          console.error('Error writing finish event:', error);
        }
      }
    } catch (e: any) {
      console.error('Error in stream processing:', e);
      if (!writerClosed) {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            content: e.message || 'An error occurred'
          })}\n\n`));
        } catch (error) {
          console.error('Error writing error event:', error);
        }
      }
    } finally {
      if (!writerClosed) {
        try {
          writerClosed = true;
          await writer.close();
        } catch (error) {
          console.error('Error closing writer:', error);
        }
      }
    }
  })();

  try {
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    writerClosed = true;
    console.error('Error creating response:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { contextBefore = '', contextAfter = '', fullContent = '', aiOptions = {} } = await request.json();
    const { suggestionLength, customInstructions, writingStyleSummary, applyStyle } = aiOptions;

    return handleInlineSuggestionRequest(contextBefore, contextAfter, fullContent, suggestionLength, customInstructions, writingStyleSummary, applyStyle);
  } catch (error: any) {
    console.error('Inline suggestion route error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 400 });
  }
}

async function streamInlineSuggestion({
  contextBefore,
  contextAfter,
  suggestionLength,
  customInstructions,
  writingStyleSummary,
  applyStyle,
  write
}: {
  contextBefore: string;
  contextAfter: string;
  fullContent?: string;
  suggestionLength: 'short' | 'medium' | 'long';
  customInstructions?: string | null;
  writingStyleSummary?: string | null;
  applyStyle: boolean;
  write: (type: string, content: string) => Promise<void>;
}) {
  const prompt = buildPrompt({ contextBefore, contextAfter, suggestionLength, customInstructions, writingStyleSummary, applyStyle });

  const maxTokens = { short: 20, medium: 50, long: 80 }[suggestionLength || 'medium'];

  const { fullStream } = streamText({
    model: myProvider.languageModel('artifact-model'),
    prompt,
    temperature: 0.4,
    maxOutputTokens: maxTokens
  });

  let suggestionContent = '';
  for await (const delta of fullStream) {
    const { type } = delta;

    if (type === 'text-delta') {
      const { text } = delta;

      suggestionContent += text;
      await write('suggestion-delta', text);
    }
  }
}

interface BuildPromptParams {
  contextBefore: string;
  contextAfter: string;
  suggestionLength: 'short' | 'medium' | 'long';
  customInstructions?: string | null;
  writingStyleSummary?: string | null;
  applyStyle: boolean;
}

function buildPrompt({
  contextBefore,
  contextAfter,
  suggestionLength,
  customInstructions,
  writingStyleSummary,
  applyStyle,
}: BuildPromptParams): string {
  const contextWindow = 200;
  const beforeSnippet = contextBefore.slice(-contextWindow);
  const afterSnippet = contextAfter.slice(0, contextWindow);
  const wordLimitMap = { short: 5, medium: 10, long: 15 } as const;
  const maxWords = wordLimitMap[suggestionLength] ?? 10;

  const prompt = `You are an expert autocomplete assistant.

Rules:
1. Return ONLY the continuation (no quotes, no line breaks, no thinking or commentary).
2. Use ${maxWords} words.
3. No lowercase letters after sentence ending punctuation.
3. Take the user's writing style and custom instructions into account.
4. DO NOT generate mid-word continuations, only generate continuations at the end of a word - i.e. don't generate continuations in the middle of a word.

${customInstructions ? `Extra instruction: ${customInstructions}\n\n` : ''}${applyStyle && writingStyleSummary ? `: ${writingStyleSummary}\n\n` : ''}Context:
${beforeSnippet}▮${afterSnippet}`;

  return prompt;
} 