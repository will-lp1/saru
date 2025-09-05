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
  applyStyle: boolean = true,
  structureInfo?: {
    trailingNewlinesBefore?: number;
    leadingNewlinesAfter?: number;
    prevChar?: string;
    nextChar?: string;
  }
) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  let writerClosed = false;

  (async () => {
    try {
      console.log("Starting to process inline suggestion stream");

      await streamInlineSuggestion({ contextBefore, contextAfter, fullContent, suggestionLength, customInstructions, writingStyleSummary, applyStyle, structureInfo, write: async (type, content) => {
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
    const { contextBefore = '', contextAfter = '', fullContent = '', structureInfo = {}, aiOptions = {} } = await request.json();
    const { suggestionLength, customInstructions, writingStyleSummary, applyStyle } = aiOptions;

    return handleInlineSuggestionRequest(contextBefore, contextAfter, fullContent, suggestionLength, customInstructions, writingStyleSummary, applyStyle, structureInfo);
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
  structureInfo,
  write
}: {
  contextBefore: string;
  contextAfter: string;
  fullContent?: string;
  suggestionLength: 'short' | 'medium' | 'long';
  customInstructions?: string | null;
  writingStyleSummary?: string | null;
  applyStyle: boolean;
  structureInfo?: {
    trailingNewlinesBefore?: number;
    leadingNewlinesAfter?: number;
    prevChar?: string;
    nextChar?: string;
  };
  write: (type: string, content: string) => Promise<void>;
}) {
  const prompt = buildPrompt({ contextBefore, contextAfter, suggestionLength, customInstructions, writingStyleSummary, applyStyle, structureInfo });

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
      const { text: textDelta } = delta;

      suggestionContent += textDelta;
      await write('suggestion-delta', textDelta);
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
  structureInfo?: {
    trailingNewlinesBefore?: number;
    leadingNewlinesAfter?: number;
    prevChar?: string;
    nextChar?: string;
  };
}

function buildPrompt({
  contextBefore,
  contextAfter,
  suggestionLength,
  customInstructions,
  writingStyleSummary,
  applyStyle,
  structureInfo,
}: BuildPromptParams): string {
  const contextWindow = 1000;

  const beforeSnippet = contextBefore.slice(-contextWindow);
  const afterSnippet = contextAfter.slice(0, contextWindow);
  const wordLimitMap = { short: 5, medium: 12, long: 25 } as const;
  const maxWords = wordLimitMap[suggestionLength] ?? 12;

  const trailingNewlinesBefore = structureInfo?.trailingNewlinesBefore ?? 0;
  const prevChar = structureInfo?.prevChar ?? '';
  const endsWithSentencePunct = /[.!?]\s*$/.test(beforeSnippet);
  const atLineStart = trailingNewlinesBefore > 0;
  const greetingBreak = prevChar === ',' && atLineStart; // e.g., "Hi mate,\n"
  const mustStartWithCapital = endsWithSentencePunct || atLineStart || greetingBreak;

  const rules: string[] = [];
  rules.push('Return ONLY the continuation (no quotes, no commentary).');
  rules.push(`The continuation must be <= ${maxWords} words.`);
  rules.push('Preserve paragraph structure: if the context ends with blank lines, start a new paragraph; otherwise continue the current sentence.');
  rules.push('If multiple blank lines indicate a gap, continue after the gap without inventing missing sections.');
  rules.push('Never start or finish in the middle of a word.');

  rules.push('If a GUIDANCE section is provided below, follow it EXACTLY.');

  if (applyStyle) {
    rules.push('Match the user\'s writing style and tone.');
  }

  rules.push(
    mustStartWithCapital
      ? 'The FIRST CHARACTER of the continuation MUST be uppercase.'
      : 'Keep capitalization consistent with the surrounding text.'
  );

  const numberedRules = rules.map((r, idx) => `${idx + 1}. ${r}`).join('\n');

  const notes: string[] = [];
  if (applyStyle && writingStyleSummary) {
    notes.push(`Writing style summary: ${writingStyleSummary}`);
  }
  if (customInstructions) {
    notes.push(`Extra instruction: ${customInstructions}`);
  }
  const notesBlock = notes.length ? `\n\nGUIDANCE:\n${notes.join('\n')}` : '';

  const prompt = `You are an expert autocomplete assistant.\n\nRules:\n${numberedRules}${notesBlock}\n\nContext ("▮" marks cursor position):\n<<<\n${beforeSnippet}▮${afterSnippet}\n>>>`;

  return prompt;
} 