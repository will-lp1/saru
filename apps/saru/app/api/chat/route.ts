import {
  type UIMessage,
  streamText,
  smoothStream,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStream,
  generateId,
  createUIMessageStreamResponse,
} from 'ai';
import { systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  getDocumentById,
  getMessagesByChatId,
  updateChatContextQuery,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  parseMessageContent,
  convertToUIMessages,
  convertUIMessageToDBFormat,
} from '@/lib/utils';
import { generateTitleFromUserMessage } from '@/app/api/chat/actions/chat';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { streamingDocument } from '@/lib/ai/tools/document-streaming';
import { isProductionEnvironment } from '@/lib/constants';
import { NextResponse } from 'next/server';
import { myProvider } from '@/lib/ai/providers';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers';
import type { Document } from '@saru/db';
import { createDocument } from '@/lib/ai/tools/create-document';
import { webSearch } from '@/lib/ai/tools/web-search';

export const maxDuration = 60;

async function createEnhancedSystemPrompt({
  selectedChatModel,
  activeDocumentId,
  mentionedDocumentIds,
  customInstructions,
  writingStyleSummary,
  applyStyle,
  availableTools = ['createDocument','streamingDocument','updateDocument','webSearch'] as Array<'createDocument'|'streamingDocument'|'updateDocument'|'webSearch'>,
}: {
  selectedChatModel: string;
  activeDocumentId?: string | null;
  mentionedDocumentIds?: string[] | null;
  customInstructions?: string | null;
  writingStyleSummary?: string | null;
  applyStyle?: boolean;
  availableTools?: Array<'createDocument'|'streamingDocument'|'updateDocument'|'webSearch'>;
}) {

  let basePrompt = systemPrompt({ selectedChatModel, availableTools });
  let contextAdded = false;

  if (customInstructions) {
    basePrompt = customInstructions + "\n\n" + basePrompt;
  }

  if (applyStyle && writingStyleSummary) {
    const styleBlock = `PERSONAL STYLE GUIDE\n• Emulate the author\'s tone, rhythm, sentence structure, vocabulary choice, and punctuation habits.\n• Do NOT copy phrases or introduce topics from the reference text.\n• Only transform wording to match style; keep semantic content from the current conversation.\nStyle description: ${writingStyleSummary}`;
    basePrompt = styleBlock + "\n\n" + basePrompt;
  }

  if (activeDocumentId) {
    try {
      const document = await getDocumentById({ id: activeDocumentId });
      if (document) {
        const documentContext = `
CURRENT DOCUMENT:
Title: ${document.title}
Content:
${document.content || '(Empty document)'}
`;
        basePrompt += `\n\n${documentContext}`;
        contextAdded = true;
      }
    } catch (error) {
    }
  }

  if (mentionedDocumentIds && mentionedDocumentIds.length > 0) {
    basePrompt += `\n\n--- MENTIONED DOCUMENTS (do not modify) ---`;
    for (const mentionedId of mentionedDocumentIds) {
      if (mentionedId === activeDocumentId) continue;

      try {
        const document = await getDocumentById({ id: mentionedId });
        if (document) {
          const mentionedContext = `
MENTIONED DOCUMENT:
Title: ${document.title}
Content:
${document.content || '(Empty document)'}
`;
          basePrompt += `\n${mentionedContext}`;
          contextAdded = true;
        }
      } catch (error) {
      }
    }
    basePrompt += `\n--- END MENTIONED DOCUMENTS ---`;
  }
  
  return basePrompt;
}

// Get a chat by ID with its messages
export async function GET(request: Request) {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user) {
      return new Response('Authentication error', { status: 401 });
    }
    
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('id');

    if (!chatId) {
      return new Response('Chat ID is required', { status: 400 });
    }

    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const dbMessages = await getMessagesByChatId({ id: chatId });
    const uiMessages = convertToUIMessages(dbMessages);
    
    return new Response(JSON.stringify({
      ...chat,
      messages: uiMessages
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return new Response('Error fetching chat', { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user) {
      return new Response('Authentication error', { status: 401 });
    }
    
    const userId = session.user.id;

    const {
      id: requestId,
      chatId: chatId,
      messages,
      selectedChatModel,
      data: requestData,
      aiOptions,
    }: {
      id: string;
      chatId: string;
      messages: Array<UIMessage>; // UIMessage type
      selectedChatModel: string;
      data?: { 
        activeDocumentId?: string | null;
        mentionedDocumentIds?: string[] | null;
        [key: string]: any; 
      };
      aiOptions?: {
        customInstructions?: string | null;
        suggestionLength?: 'short' | 'medium' | 'long';
        writingStyleSummary?: string | null;
        applyStyle?: boolean;
      } | null;
    } = await request.json();

    const activeDocumentId = requestData?.activeDocumentId ?? undefined;
    const mentionedDocumentIds = requestData?.mentionedDocumentIds ?? undefined;
    const customInstructions = aiOptions?.customInstructions ?? null;
    const suggestionLength = aiOptions?.suggestionLength ?? 'medium';
    const writingStyleSummary = aiOptions?.writingStyleSummary ?? null;
    const applyStyle = aiOptions?.applyStyle ?? true;

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(chatId)) {
      return new Response('Invalid chat ID format', { status: 400 });
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      const title = await generateTitleFromUserMessage({ message: userMessage });
      await saveChat({
        id: chatId,
        userId: userId,
        title,
        document_context: {
          active: activeDocumentId,
          mentioned: mentionedDocumentIds
        }
      });
    } else {
      if (chat.userId !== userId) {
        return new Response('Unauthorized', { status: 401 });
      }
      
      await updateChatContextQuery({ 
        chatId, 
        userId,
        context: {
          active: activeDocumentId,
          mentioned: mentionedDocumentIds
        }
      });
    }

    const userMessageBackendId = generateUUID();

    // Save user message with parts structure
    await saveMessages({
      messages: [{
        id: userMessageBackendId,
        chatId: chatId,
        role: userMessage.role,
        content: parseMessageContent(userMessage.parts),
        createdAt: new Date().toISOString(),
      }],
    });

    let validatedActiveDocumentId: string | undefined;
    let activeDoc: any = null;
    if (activeDocumentId && uuidRegex.test(activeDocumentId)) {
      try {
        activeDoc = await getDocumentById({ id: activeDocumentId });
        if (activeDoc) {
          validatedActiveDocumentId = activeDocumentId;
        }
      } catch (error) {
        console.error(`Error loading active document ${activeDocumentId}:`, error);
      }
    }

    const dynamicSystemPrompt = await createEnhancedSystemPrompt({
      selectedChatModel,
      activeDocumentId,
      mentionedDocumentIds,
      customInstructions,
      writingStyleSummary,
      applyStyle,
      availableTools: [], // Will be set below
    });

    const stream = createUIMessageStream({
      originalMessages: messages, 
      execute: ({ writer }) => {
        const availableTools: any = {};
        const activeToolsList: Array<'createDocument' | 'streamingDocument' | 'updateDocument' | 'webSearch'> = [];

        if (!validatedActiveDocumentId) {
          availableTools.createDocument = createDocument({ 
            session, 
            writer // Pass writer for streaming
          });
          availableTools.streamingDocument = streamingDocument({ 
            session, 
            writer 
          });
          activeToolsList.push('createDocument', 'streamingDocument');
        } 
        else if (!activeDoc?.content || activeDoc.content.trim().length === 0) {
          availableTools.streamingDocument = streamingDocument({ 
            session,
            documentId: validatedActiveDocumentId, 
            writer
          });
          activeToolsList.push('streamingDocument');
        }
        else {
          availableTools.updateDocument = updateDocument({ 
            session, 
            documentId: validatedActiveDocumentId,
            writer 
          });
          activeToolsList.push('updateDocument');
        }

        if (process.env.TAVILY_API_KEY) {
          availableTools.webSearch = webSearch({ 
            session, 
            writer
          });
          activeToolsList.push('webSearch');
        }

        // Stream initial status
        writer.write({
          type: 'data-status',
          id: generateId(),
          data: { 
            type: 'chat-started',
            activeDocumentId: validatedActiveDocumentId,
            availableTools: activeToolsList
          },
        });

        const result = streamText({
          model: myProvider.languageModel(selectedChatModel),
          system: dynamicSystemPrompt,
          messages: convertToModelMessages(messages),
          stopWhen: stepCountIs(2),
          experimental_activeTools: activeToolsList,

          experimental_transform: smoothStream({
            chunking: 'word',
          }),

          tools: availableTools,

          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        // Merge the streamText result into the writer
        writer.merge(result.toUIMessageStream());
      },

      onFinish: async ({ messages: allMessages }) => {  

        if (userId) {
          try {
            // Get only the assistant messages (response messages)
            const responseMessages = allMessages.filter(msg => 
              msg.role === 'assistant' && 
              !allMessages.slice(0, allMessages.indexOf(msg)).some(original => original.id === msg.id)
            );

            // Convert response messages to database format
            const dbMessages = responseMessages.map(msg => 
              convertUIMessageToDBFormat(msg, chatId)
            );

            if (dbMessages.length > 0) {
              await saveMessages({
                messages: dbMessages,
              });
            }
            
            await updateChatContextQuery({ 
              chatId, 
              userId,
              context: {
                active: activeDocumentId,
                mentioned: mentionedDocumentIds
              }
            });
          } catch (error) {
            console.error('Failed to save chat/messages onFinish:', error);
          }
        }
      },
    });

    return createUIMessageStreamResponse({ stream });



  } catch (error) {
    console.error('Chat route error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user) {
      return new Response('Authentication error', { status: 401 });
    }
    
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const rawChatId = searchParams.get('id');

    if (!rawChatId) {
      return new Response('Chat ID is required', { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(rawChatId)) {
      return new Response('Invalid chat ID format', { status: 400 });
    }

    const chat = await getChatById({ id: rawChatId });

    if (!chat) {
      return new Response('Chat not found', { status: 404 });
    }

    if (chat.userId !== userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id: rawChatId });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return new Response('Error deleting chat', { status: 500 });
  }
}
