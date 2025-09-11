import { NextResponse, NextRequest } from 'next/server';
import { streamText, smoothStream } from 'ai';
import { getDocumentById } from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/providers';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { getSessionCookie } from 'better-auth/cookies';

function createTokenBatcher(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  writerClosed: () => boolean
) {
  let buffer = '';
  let lastFlush = 0;
  let flushTimeout: NodeJS.Timeout | null = null;
  const minFlushInterval = 16;
  const maxBatchSize = 50;
  const maxWaitTime = 100;

  const flush = async (type: string) => {
    if (writerClosed() || !buffer) return;

    try {
      const data = encoder.encode(`data: ${JSON.stringify({
        type,
        content: buffer
      })}\n\n`);
      await writer.write(data);
      buffer = '';
      lastFlush = Date.now();

      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
    } catch (error) {
      console.error('Error flushing batch:', error);
    }
  };

  const addToken = async (type: string, content: string) => {
    if (writerClosed()) return;
    buffer += content;
    const now = Date.now();
    const timeSinceLastFlush = now - lastFlush;

    const shouldFlushNow = 
      buffer.length >= maxBatchSize ||
      timeSinceLastFlush >= maxWaitTime ||
      content.includes(' ') ||
      /[.!?]/.test(content);

    if (shouldFlushNow && timeSinceLastFlush >= minFlushInterval) {
      await flush(type);
    } else if (!flushTimeout) {
      flushTimeout = setTimeout(() => {
        flush(type);
      }, Math.min(maxWaitTime, minFlushInterval));
    }
  };

  const finalFlush = async (type: string) => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    await flush(type);
  };

  return { addToken, finalFlush };
}

const createEncodedMessages = (encoder: TextEncoder) => ({
  FINISH: encoder.encode(`data: ${JSON.stringify({ type: 'finish', content: '' })}\n\n`),
  createError: (message: string) => encoder.encode(`data: ${JSON.stringify({
    type: 'error',
    content: message
  })}\n\n`)
});

async function handleSuggestionRequest(
  documentId: string,
  description: string,
  userId: string,
  selectedText?: string,
  suggestionLength: 'short' | 'medium' | 'long' = 'medium',
  customInstructions?: string | null,
  writingStyleSummary?: string | null,
  applyStyle: boolean = true
) {
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();
  const encodedMessages = createEncodedMessages(encoder);
  let writerClosed = false;

  const getWriterClosed = () => writerClosed;
  const batcher = createTokenBatcher(writer, encoder, getWriterClosed);

  (async () => {
    try {
      const document = await getDocumentById({ id: documentId });
      if (!document) throw new Error('Document not found');
      console.log("Starting to process suggestion stream");
      
      // Pre-encoded initial messages
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'id', content: documentId })}\n\n`));

      const isPartialEdit = !!selectedText;
      if (isPartialEdit) {
        console.log("Processing partial edit with selected text");
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'original', content: selectedText })}\n\n`));
      } else {
        console.log("Processing full document edit");
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'clear', content: '' })}\n\n`));
      }

      console.log("Starting to stream suggestion with prompt:", description);
      await streamSuggestion({
        document,
        description,
        selectedText,
        suggestionLength,
        customInstructions,
        writingStyleSummary,
        applyStyle,
        write: async (type, content) => {
          await batcher.addToken(type, content);
        }
      });

      // Ensure all tokens are flushed
      await batcher.finalFlush('suggestion-delta');

      if (!writerClosed) {
        await writer.write(encodedMessages.FINISH);
      }
    } catch (e: any) {
      console.error('Error in stream processing:', e);
      if (!writerClosed) {
        try {
          await writer.write(encodedMessages.createError(e.message || 'An error occurred'));
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
      console.log("Stream closed");
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}

export async function GET(request: Request) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionCookie;

    const url = new URL(request.url);
    const documentId = url.searchParams.get('documentId');
    const description = url.searchParams.get('description');
    const selectedText = url.searchParams.get('selectedText') || undefined;
    const suggestionLength = (url.searchParams.get('suggestionLength') as 'short' | 'medium' | 'long' | null) || 'medium';
    const customInstructions = url.searchParams.get('customInstructions') || null;
    const writingStyleSummary = url.searchParams.get('writingStyleSummary') || null;
    const applyStyle = url.searchParams.get('applyStyle') === 'true';

    if (!documentId || !description) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    return handleSuggestionRequest(documentId, description, userId, selectedText, suggestionLength, customInstructions, writingStyleSummary, applyStyle);
  } catch (error: any) {
    console.error('Suggestion GET route error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = sessionCookie;

    const {
      documentId,
      description,
      selectedText,
      aiOptions = {}
    } = await request.json();

    const { suggestionLength = 'medium', customInstructions = null, writingStyleSummary = null, applyStyle = true } = aiOptions;

    if (!documentId || !description) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    return handleSuggestionRequest(documentId, description, userId, selectedText, suggestionLength, customInstructions, writingStyleSummary, applyStyle);
  } catch (error: any) {
    console.error('Suggestion POST route error:', error);
    return NextResponse.json({ error: error.message || 'An error occurred' }, { status: 400 });
  }
}

async function streamSuggestion({
  document,
  description,
  selectedText,
  suggestionLength,
  customInstructions,
  writingStyleSummary,
  applyStyle,
  write
}: {
  document: any;
  description: string;
  selectedText?: string;
  suggestionLength: 'short' | 'medium' | 'long';
  customInstructions?: string | null;
  writingStyleSummary?: string | null;
  applyStyle: boolean;
  write: (type: string, content: string) => Promise<void>;
}) {
  const contentToModify = selectedText || document.content;
  let promptContext = selectedText 
    ? `You are an expert text editor. Your task is to refine a given piece of text based on a specific instruction.
Original selected text:
"""
${selectedText}
"""

Instruction: "${description}"`
    : description;

  if (customInstructions) {
    promptContext = `${customInstructions}\n\n${promptContext}`;
  }

  if (applyStyle && writingStyleSummary) {
    const styleBlock = `PERSONAL STYLE GUIDE\n• Emulate the author\'s tone, rhythm, sentence structure, vocabulary choice, and punctuation habits.\n• Do NOT copy phrases or introduce topics from the reference text.\n• Only transform wording; preserve original meaning.\nStyle description: ${writingStyleSummary}`;
    promptContext = `${styleBlock}\n\n${promptContext}`;
  }

  const lengthMap = { short: 'concise', medium: 'a moderate amount of detail', long: 'comprehensively' };
  const lengthDirective = lengthMap[suggestionLength] || lengthMap.medium;
  promptContext += `\n\nPlease respond ${lengthDirective}.`;

  if (selectedText) {
    promptContext += `\n\nPlease provide ONLY the modified version of the selected text.
If the instruction implies a small change, try to keep the rest of the original text intact as much as possible.
Only output the resulting text, with no preamble or explanation.`;
  }

  console.log("Starting stream text generation with content length:", contentToModify.length, "and options:", { suggestionLength, customInstructions });

  const { fullStream } = streamText({
    model: myProvider.languageModel('artifact-model'),
    system: updateDocumentPrompt(contentToModify, 'text'),
    experimental_transform: smoothStream({ chunking: 'word' }),
    prompt: promptContext,
    providerOptions: {
      openai: {
        prediction: {
          type: 'content',
          content: contentToModify,
        }
      }
    }
  });

  let chunkCount = 0;
  for await (const delta of fullStream) {
    if (delta.type === 'text-delta') {
      chunkCount++;

      if (chunkCount % 100 === 0) {
        console.log(`Stream progress: ${chunkCount} chunks processed`);
      }

      await write('suggestion-delta', delta.text);
    }
  }

  console.log(`Stream complete: ${chunkCount} chunks processed`);
}