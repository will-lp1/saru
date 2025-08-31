'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect } from 'react';
import { ChatHeader } from '@/components/chat/chat-header';
import { generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { MentionedDocument } from './multimodal-input';
import { useDocument } from '@/hooks/use-document';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAiOptionsValue } from '@/hooks/ai-options';
import type { Attachment, ChatMessage } from '@/lib/types';

export interface ChatProps {
  id?: string;
  initialMessages: ChatMessage[];
  selectedChatModel?: string;
  isReadonly?: boolean;
}

export function Chat({
  id: initialId,
  initialMessages,
  selectedChatModel: initialSelectedChatModel,
  isReadonly = false,
}: ChatProps) {
  const { document } = useDocument();
  const [documentContextActive, setDocumentContextActive] = useState(false);
  const { writingStyleSummary, applyStyle } = useAiOptionsValue();
  const [chatId, setChatId] = useState(() => initialId || generateUUID());
  
  const [selectedChatModel, setSelectedChatModel] = useState(
    () => initialSelectedChatModel || DEFAULT_CHAT_MODEL
  );
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [requestedChatLoadId, setRequestedChatLoadId] = useState<string | null>(null);

  // Callback function to update the model state
  const handleModelChange = (newModelId: string) => {
    setSelectedChatModel(newModelId);
    console.log('[Chat] Model changed to:', newModelId);
  };

  const [confirmedMentions, setConfirmedMentions] = useState<MentionedDocument[]>([]);

  useEffect(() => {
    const hasDocumentContext = document.documentId !== 'init';
    setDocumentContextActive(Boolean(hasDocumentContext));
    
    if (hasDocumentContext) {
      console.log('[Chat] Using document context in chat:', {
        documentId: document.documentId,
        title: document.title,
        contentLength: document.content.length
      });
    }
  }, [document.documentId, document.content, document.title]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat<ChatMessage>({
    id: chatId,
    messages: initialMessages,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages, id }) => {
        const currentDocId = document.documentId;
        const contextData: { activeDocumentId?: string | null; mentionedDocumentIds?: string[] } = {};
        if (currentDocId && currentDocId !== 'init') {
          contextData.activeDocumentId = currentDocId;
        } else {
          contextData.activeDocumentId = null;
        }
        if (confirmedMentions.length > 0) {
          contextData.mentionedDocumentIds = confirmedMentions.map((doc) => doc.id);
        }

        return {
          body: {
            id,
            message: messages.at(-1),
            selectedChatModel: selectedChatModel,
            data: contextData,
            aiOptions: {
              writingStyleSummary,
              applyStyle,
            },
          },
        };
      },
    }),
    onError: (err: unknown) => {
      console.error('Chat Error:', err);
    },
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [input, setInput] = useState('');

  const handleMentionsChange = (mentions: MentionedDocument[]) => {
    setConfirmedMentions(mentions);
  };

  useEffect(() => {
    const handleResetChatInput = (event: CustomEvent) => {
      const detail = event.detail as { chatId: string } | undefined;
      
      if (detail && detail.chatId === chatId) {
        setInput('');
        if (messages.length > initialMessages.length) {
          setMessages(initialMessages);
        }
      }
    };

    window.addEventListener('reset-chat-input', handleResetChatInput as EventListener);
    
    return () => {
      window.removeEventListener('reset-chat-input', handleResetChatInput as EventListener);
    };
  }, [chatId, initialMessages, setInput, messages, setMessages]);

  useEffect(() => {
    const loadHistory = async (idToLoad: string) => {

      console.log(`[Chat useEffect] Starting load for explicitly requested chatId: ${idToLoad}`);
      setIsLoadingChat(true);
      console.time(`[Chat useEffect] Load ${idToLoad}`);

      try {
        setRequestedChatLoadId(null);

        console.time(`[Chat useEffect] Fetch ${idToLoad}`);
        const chatResponse = await fetch(`/api/chat?id=${idToLoad}`);
        console.timeEnd(`[Chat useEffect] Fetch ${idToLoad}`);

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          console.error(`[Chat useEffect] Fetch failed for ${idToLoad}. Status: ${chatResponse.status}. Body: ${errorText}`);
          throw new Error(`Failed to fetch chat: ${chatResponse.statusText}`);
        }

        const chatData = await chatResponse.json();
        if (!chatData || !chatData.messages) {
          console.error(`[Chat useEffect] Invalid chat data received for ${idToLoad}. Data:`, chatData);
          throw new Error('Invalid chat data received');
        }

        setInput('');
        setMessages(chatData.messages);

        console.log(`[Chat useEffect] Successfully loaded chat ${idToLoad}`);

      } catch (error) {
        console.error(`[Chat useEffect] CATCH BLOCK - Error loading chat ${idToLoad}:`, error);
        toast.error(`Failed to load chat history for ${idToLoad}`);
        setMessages(initialMessages);
        setInput('');
      } finally {
        setIsLoadingChat(false);
        console.timeEnd(`[Chat useEffect] Load ${idToLoad}`);
      }
    };

    if (requestedChatLoadId) {
      loadHistory(requestedChatLoadId);
    }

  }, [requestedChatLoadId, setMessages, setInput, initialMessages]);

  useEffect(() => {
    const handleLoadChatEvent = (event: CustomEvent<{ chatId: string }>) => {
      const detail = event.detail;
      if (!detail || !detail.chatId) return;

      console.log(`[Chat EventListener] Received load-chat event for ${detail.chatId}. Current state chatId: ${chatId}. Setting new chatId.`);

      if (detail.chatId !== chatId) {
          setChatId(detail.chatId);
          setRequestedChatLoadId(detail.chatId);
      }
    };

    window.addEventListener('load-chat', handleLoadChatEvent as unknown as EventListener);

    return () => {
      window.removeEventListener('load-chat', handleLoadChatEvent as unknown as EventListener);
    };
  }, [chatId]);

  useEffect(() => {
    const handleChatIdChanged = (event: CustomEvent<{ oldChatId: string, newChatId: string }>) => {
      const { oldChatId, newChatId } = event.detail;
      
      if (oldChatId === chatId) {
        console.log(`[Chat] Changing chat ID from ${oldChatId} to ${newChatId}`);
      }
    };
    
    window.addEventListener('chat-id-changed', handleChatIdChanged as unknown as EventListener);
    
    return () => {
      window.removeEventListener('chat-id-changed', handleChatIdChanged as unknown as EventListener);
    };
  }, [chatId]);

  useEffect(() => {
    const handleReset = () => {
      console.log('[Chat Component] Received reset-chat-state event');
      const newChatId = generateUUID();
      setMessages([]);
      setInput('');
      setChatId(newChatId);
      console.log('[Chat Component] Chat state reset. New ID:', newChatId);
    };

    window.addEventListener('reset-chat-state', handleReset);

    return () => {
      window.removeEventListener('reset-chat-state', handleReset);
    };
  }, [setMessages, setInput, setChatId]);

  const wrappedSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form submit is handled by the input component; we only reset mentions here.
    setConfirmedMentions([]);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ChatHeader
        chatId={chatId}
        selectedModelId={selectedChatModel}
        isReadonly={isReadonly}
        onModelChange={handleModelChange}
      />

      <div className="flex-1 overflow-y-auto relative">
        {isLoadingChat ? (
           <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
           </div>
         ) : (
          <Messages
            chatId={chatId}
            status={status}
            messages={messages}
            setMessages={setMessages}
            regenerate={regenerate}
            isReadonly={isReadonly}
            isArtifactVisible={false}
          />
         )}
      </div>

      {!isReadonly && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          <form onSubmit={wrappedSubmit}>
            <MultimodalInput
              chatId={chatId}
              input={input}
              setInput={setInput}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={sendMessage}
              confirmedMentions={confirmedMentions}
              onMentionsChange={handleMentionsChange}
            />
          </form>
        </div>
      )}

      <DataStreamHandler id={chatId} />
    </div>
  );
}
