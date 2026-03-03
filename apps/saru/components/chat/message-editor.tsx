'use client';

import { UIMessage } from 'ai';
import { UseChatHelpers } from '@ai-sdk/react';
import { Button } from '../ui/button';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Textarea } from '../ui/textarea';
import { deleteTrailingMessages } from '@/app/api/chat/actions/chat';

export type MessageEditorProps = {
  message: UIMessage;
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: UseChatHelpers<UIMessage>['setMessages'];
  regenerate: UseChatHelpers<UIMessage>['regenerate'];
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  regenerate,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const textParts = message.parts?.filter(part => part.type === 'text') || [];
  const originalMarkup = textParts.map(part => part.text).join('');

  const mentionMap = new Map<string, string>();
  for (const match of originalMarkup.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)) {
    mentionMap.set(match[1], match[2]);
  }

  const initialContent = originalMarkup.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  const [draftContent, setDraftContent] = useState<string>(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftContent(event.target.value);
    adjustHeight();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Textarea
        data-testid="message-editor"
        ref={textareaRef}
        className="bg-transparent outline-none overflow-hidden resize-none !text-base rounded-xl w-full"
        value={draftContent}
        onChange={handleInput}
      />

      <div className="flex flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode('view');
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid="message-editor-send-button"
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);

            // Restore markup for any mentions still present in the draft
            let finalText = draftContent;
            for (const [title, id] of mentionMap) {
              finalText = finalText.split(`@${title}`).join(`@[${title}](${id})`);
            }

            await deleteTrailingMessages({
              id: message.id,
            });

            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id);

              if (index !== -1) {
                const updatedMessage: UIMessage = {
                  ...message,
                  parts: [{ type: 'text', text: finalText }],
                };

                return [...messages.slice(0, index), updatedMessage];
              }

              return messages;
            });

            setMode('view');
            regenerate({ messageId: message.id });
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
