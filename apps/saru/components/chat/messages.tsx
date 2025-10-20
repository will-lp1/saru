import { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { Overview } from './overview';
import { Dispatch, memo, RefObject, SetStateAction, useEffect } from 'react';
import { UseChatHelpers } from '@ai-sdk/react';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<UIMessage>['status'];
  messages: Array<UIMessage>;
  setMessages: Dispatch<SetStateAction<Array<UIMessage>>>;
  regenerate: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
}

function PureMessages({
  chatId,
  status,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  messagesEndRef,
}: MessagesProps) {
  useEffect(() => {
    const handleToolResult = (event: CustomEvent) => {
      const { toolCallId, result: updatedResult } = event.detail;

      setMessages(prevMessages =>
        prevMessages.map(message => {
          if (message.role === 'assistant' && message.parts) {
            const updatedParts = message.parts.map(part => {
              if (part.type?.startsWith('tool-') && 'toolCallId' in part && part.toolCallId === toolCallId) {
                return {
                  ...part,
                  output: updatedResult,
                };
              }
              return part;
            });

            return {
              ...message,
              parts: updatedParts,
            };
          }
          return message;
        })
      );
    };

    window.addEventListener('tool-result', handleToolResult as EventListener);
    return () => window.removeEventListener('tool-result', handleToolResult as EventListener);
  }, [setMessages]);

  return (
    <div
      className="flex flex-col min-w-0 gap-6 pt-4"
    >
      {messages.length === 0 && <Overview />}

      {messages.map((message, index) => {
        return (
          <PreviewMessage
            key={message.id}
            chatId={chatId}
            message={message}
            isLoading={status === 'streaming' && messages.length - 1 === index}
            setMessages={setMessages}
            regenerate={regenerate}
            isReadonly={isReadonly}
          />
        );
      })}

      {status === 'submitted' &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'user' && <ThinkingMessage />}

      <div
        ref={messagesEndRef}
        className="shrink-0 min-w-[24px] min-h-[24px]"
      />
    </div>
  );
}

export const Messages = memo(PureMessages, () => false);
