import { NextResponse, NextRequest } from 'next/server';
import { streamText, smoothStream } from 'ai';
import { getDocumentById } from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/providers';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import { getSessionCookie } from 'better-auth/cookies';

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

  (async () => {
    try {
      const document = await getDocumentById({ id: documentId });
      if (!document) throw new Error('Document not found');
      console.log("Starting to process suggestion stream");
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
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type, content })}\n\n`));
        }
      });

      console.log("Finished processing suggestion, sending finish event");
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'finish', content: '' })}\n\n`));
    } catch (e: any) {
      console.error('Error in stream processing:', e);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: e.message || 'An error occurred' })}\n\n`));
    } finally {
      await writer.close();
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
  let draftContent = '';
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
    experimental_providerMetadata: {
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
    const { type } = delta;

    if (type === 'text-delta') {
      const { textDelta } = delta;
      draftContent += textDelta;
      chunkCount++;

      if (chunkCount % 10 === 0) {
        console.log(`Stream progress: ${draftContent.length} characters processed (${chunkCount} chunks)`);
      }

      await write('suggestion-delta', textDelta);
    }
  }

  console.log(`Stream complete: Generated ${draftContent.length} characters in ${chunkCount} chunks`);
} 