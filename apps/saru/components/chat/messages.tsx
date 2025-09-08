import { UIMessage } from 'ai';
import { PreviewMessage, ThinkingMessage } from './message';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { Overview } from './overview';
import { Dispatch, memo, SetStateAction } from 'react';
import equal from 'fast-deep-equal';
import { UseChatHelpers } from '@ai-sdk/react';

interface MessagesProps {
  chatId: string;
  status: UseChatHelpers<UIMessage>['status'];
  messages: Array<UIMessage>;
  setMessages: Dispatch<SetStateAction<Array<UIMessage>>>;
  regenerate: UseChatHelpers<UIMessage>['regenerate'];
  isReadonly: boolean;
  isArtifactVisible: boolean;
}

function PureMessages({
  chatId,
  status,
  messages,
  setMessages,
  regenerate,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  return (
    <div
      ref={messagesContainerRef}
      className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
    >
      {messages.length === 0 && <Overview />}

      {messages.map((message, index) => {
        return (
          <PreviewMessage
            key={`${index}-${message.id}`}
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

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isArtifactVisible && nextProps.isArtifactVisible) return true;

  if (prevProps.status !== nextProps.status) return false;
  if (prevProps.status && nextProps.status) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;
  return true;
});
