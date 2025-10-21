'use client';

import type { UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChatHeader } from '@/components/chat/chat-header';
import { generateUUID } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { MentionedDocument } from './multimodal-input';
import { useDocument } from '@/hooks/use-document';
import { DEFAULT_CHAT_MODEL } from '@/lib/ai/models';
import { useAiOptionsValue } from '@/hooks/ai-options';
import { mutate as globalMutate } from 'swr';
import type { ChatContextPayload, ChatAiOptions } from '@/types/chat';
import { Skeleton } from '@/components/ui/skeleton';

const SkeletonMessage = ({ role }: { role: 'user' | 'assistant' }) => (
  <motion.div
    className="w-full mx-auto max-w-3xl px-4 group/message"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    data-role={role}
  >
    <div
      className={cn(
        "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
        {
          "group-data-[role=user]/message:bg-muted": true,
        }
      )}
    >
      <div className="size-8 flex items-center justify-center rounded-full ring-1 shrink-0 ring-border overflow-hidden relative">
        {role === 'assistant' ? (
          <Skeleton className="size-8 rounded-full" />
        ) : (
          <Skeleton className="size-8 rounded-full" />
        )}
      </div>

      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          {role === 'assistant' && <Skeleton className="h-4 w-2/3" />}
        </div>
      </div>
    </div>
  </motion.div>
);

export interface ChatProps {
  id?: string;
  initialMessages: Array<UIMessage>;
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

  // Input state management (now manual in v5)
  const [input, setInput] = useState('');

  // Callback function to update the model state
  const handleModelChange = (newModelId: string) => {
    setSelectedChatModel(newModelId);
  };

  const [confirmedMentions, setConfirmedMentions] = useState<MentionedDocument[]>([]);
  const [messagesContainerRef, messagesEndRef, scrollToBottom] =
    useScrollToBottom<HTMLDivElement>();

  useEffect(() => {
    const hasDocumentContext = document.documentId !== 'init';
    setDocumentContextActive(Boolean(hasDocumentContext));
  }, [document.documentId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
  } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    messages: initialMessages,
    generateId: generateUUID,
  onData: (payload: any) => {
    try {
      const data = payload && typeof payload === 'object' && 'data' in payload ? (payload as any).data : payload;
      const payloadDocumentId = typeof data?.documentId === 'string' && data.documentId.length > 0
        ? data.documentId
        : document.documentId;

      if (data?.kind === 'editor-stream-text' && typeof (data as any).content === 'string') {
        const event = new CustomEvent('editor:stream-text', {
          detail: { documentId: payloadDocumentId, content: (data as any).content },
        });
        window.dispatchEvent(event);
      }

      // Artifact streaming bridge: forward markdown artifact deltas to editor
      if (data?.kind === 'artifact' && data?.name === 'markdown' && typeof (data as any).delta === 'string') {
        const artifactEvent = new CustomEvent('editor:stream-artifact', {
          detail: { documentId: payloadDocumentId, name: 'markdown', delta: (data as any).delta },
        });
        window.dispatchEvent(artifactEvent);
      }

      if (data?.kind === 'editor-stream-finish') {
        const finishEvent = new CustomEvent('editor:creation-stream-finished', {
          detail: { documentId: payloadDocumentId },
        });
        window.dispatchEvent(finishEvent);
      }
    } catch {}
  },
  onError: (err) => {
    console.error('Chat Error:', err);
  },
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'submitted' || status === 'streaming') {
      timer = setTimeout(() => scrollToBottom(), 50);
    }
    else if (messages.length > 0) {
      timer = setTimeout(() => scrollToBottom(), 100);
    }

    return () => timer && clearTimeout(timer);
  }, [status, messages.length, scrollToBottom]);

  const [attachments, setAttachments] = useState<FileList | null>(null);

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
      setIsLoadingChat(true);

      try {
        setRequestedChatLoadId(null);

        const chatResponse = await fetch(`/api/chat?id=${idToLoad}`);

        if (!chatResponse.ok) {
          const errorText = await chatResponse.text();
          throw new Error(`Failed to fetch chat: ${chatResponse.statusText}`);
        }

        const chatData = await chatResponse.json();
        if (!chatData || !chatData.messages) {
          throw new Error('Invalid chat data received');
        }

        setInput('');
        setMessages(chatData.messages);

      } catch (error) {
        toast.error(`Failed to load chat history for ${idToLoad}`);
        setMessages(initialMessages);
        setInput('');
      } finally {
        setIsLoadingChat(false);
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

      if (detail.chatId !== chatId) {
          setChatId(detail.chatId);
          setRequestedChatLoadId(detail.chatId);
          globalMutate('/api/history');
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
      }
    };
    
    window.addEventListener('chat-id-changed', handleChatIdChanged as unknown as EventListener);
    
    return () => {
      window.removeEventListener('chat-id-changed', handleChatIdChanged as unknown as EventListener);
    };
  }, [chatId]);

  useEffect(() => {
    const handleReset = () => {
      const newChatId = generateUUID();
      setMessages([]);
      setInput('');
      setChatId(newChatId);
    };

    window.addEventListener('reset-chat-state', handleReset);

    return () => {
      window.removeEventListener('reset-chat-state', handleReset);
    };
  }, [setMessages, setInput, setChatId]);

  const buildRequestBody = useCallback(
    (body?: Record<string, unknown>) => {
      const activeDocumentId =
        document.documentId && document.documentId !== 'init'
          ? document.documentId
          : null;

      const incoming = body ?? {};
      const incomingData =
        typeof incoming.data === 'object' && incoming.data !== null
          ? (incoming.data as ChatContextPayload)
          : {};
      const incomingAiOptions =
        typeof incoming.aiOptions === 'object' && incoming.aiOptions !== null
          ? (incoming.aiOptions as ChatAiOptions)
          : {};

      const mergedData: ChatContextPayload = {
        ...incomingData,
        activeDocumentId:
          incomingData.activeDocumentId !== undefined
            ? incomingData.activeDocumentId
            : activeDocumentId,
      };

      const mergedAiOptions: ChatAiOptions = {
        writingStyleSummary,
        applyStyle,
        ...incomingAiOptions,
      };

      return {
        ...incoming,
        chatId,
        selectedChatModel,
        data: mergedData,
        aiOptions: mergedAiOptions,
      };
    },
    [chatId, selectedChatModel, document.documentId, writingStyleSummary, applyStyle],
  );

  const regenerateWithContext = useCallback(
    (options?: Parameters<typeof regenerate>[0]) => {
      const existingBody =
        options && typeof options.body === 'object' && options.body !== null
          ? (options.body as Record<string, unknown>)
          : undefined;

      return regenerate({
        ...options,
        body: buildRequestBody(existingBody),
      });
    },
    [regenerate, buildRequestBody],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    scrollToBottom();

    if (documentContextActive && messages.length === initialMessages.length) {
      toast.success(`Using document context: ${document.title}`, {
        icon: <FileText className="size-4" />,
        duration: 3000,
        id: `doc-context-${document.documentId}`
      });
    }

    const contextData: ChatContextPayload = {
      activeDocumentId:
        document.documentId && document.documentId !== 'init'
          ? document.documentId
          : null,
    };

    if (confirmedMentions.length > 0) {
      contextData.mentionedDocumentIds = confirmedMentions.map(doc => doc.id);
    }

    const requestBody = buildRequestBody({
      data: contextData,
    });

    sendMessage(
    { parts: [{ type: 'text', text: input }] },
    {
      body: requestBody,
    }
  );

    // Clear input and attachments
    setInput('');
    setAttachments(null);
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

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto relative"
      >
        <AnimatePresence mode="wait">
          {isLoadingChat ? (
            <motion.div
              key="loading"
              className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Show skeleton messages to indicate loading */}
              <SkeletonMessage role="user" />
              <SkeletonMessage role="assistant" />
              <SkeletonMessage role="user" />
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Messages
                chatId={chatId}
                status={status}
                messages={messages}
                setMessages={setMessages}
                regenerate={regenerateWithContext}
                isReadonly={isReadonly}
                isArtifactVisible={false}
                messagesEndRef={messagesEndRef}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isReadonly && (
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
          <form onSubmit={handleSubmit}>
            <MultimodalInput
              chatId={chatId}
              selectedChatModel={selectedChatModel}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              sendMessage={sendMessage} // Updated from append to sendMessage
              confirmedMentions={confirmedMentions}
              onMentionsChange={handleMentionsChange}
            />
          </form>
        </div>
      )}

      {/* <DataStreamHandler id={chatId} /> */}
    </div>
  );
}
