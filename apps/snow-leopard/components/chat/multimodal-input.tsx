'use client';
import cx from 'classnames';
import type React from 'react';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { MentionsInput, Mention, type SuggestionDataItem, type MentionsInputProps } from 'react-mentions';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { Attachment, ChatMessage } from '@/lib/types';

import { ArrowUpIcon, StopIcon } from '../icons';
import { Button } from '../ui/button';
import { SuggestedActions } from '../suggested-actions';
import equal from 'fast-deep-equal';
import { useDocument } from '@/hooks/use-document';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { cn, generateUUID, sanitizeUIMessages } from '@/lib/utils';

interface DocumentSuggestion extends SuggestionDataItem {
  id: string;
  display: string;
}

export interface MentionedDocument {
  id: string;
  title: string;
}

const mentionInputStyle: MentionsInputProps['style'] = {
  control: {
    fontSize: 14,
    lineHeight: 1.5,
    borderRadius: '1rem', // rounded-2xl
    backgroundColor: 'hsl(var(--muted))', // Use CSS variable
    border: '1px solid hsl(var(--border))', // Use CSS variable
    color: 'hsl(var(--foreground))', // Use CSS variable for text
  },
  '&multiLine': {
    control: {
      fontFamily: 'inherit',
      minHeight: 56,
    },
    highlighter: {
      padding: 9, // Adjust to match textarea padding
      paddingBottom: 41, // Match pb-10
      border: '1px solid transparent',
    },
    input: {
      padding: '9px 12px', // Match highlighter padding
      paddingBottom: 41,
      minHeight: 30, // Adjust for alignment
      outline: 'none',
      border: 'none',
      lineHeight: 1.5,
      fontSize: 14, // text-base
      color: 'hsl(var(--foreground))', // Use CSS variable for input text
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      fontSize: 14,
      borderRadius: '0.375rem',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      maxHeight: 240,
      overflowY: 'auto',
      zIndex: 20,
      marginTop: '-1px',
      position: 'absolute',
      bottom: '100%',
      left: 0,
      width: 320,
    },
    item: {
      padding: '8px 12px',
      borderBottom: '1px solid hsl(var(--border))',
      color: 'hsl(var(--foreground))',
      '&focused': {
        backgroundColor: 'hsl(var(--accent))',
        color: 'hsl(var(--accent-foreground))',
      },
    },
  },
};
    
const mentionStyleLight: React.CSSProperties = {
  backgroundColor: '#dbeafe',
  padding: '1px 2px',
  borderRadius: '0.25rem',
  fontWeight: 500,
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
};

const mentionStyleDark: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.2)',
  padding: '1px 2px',
  borderRadius: '0.25rem',
  fontWeight: 500,
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
};

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  className,
  confirmedMentions,
  onMentionsChange,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<ChatMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  append: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  confirmedMentions: MentionedDocument[];
  onMentionsChange: (mentions: MentionedDocument[]) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionInputRef = useRef<any>(null);
  const { width } = useWindowSize();
  const { document: currentDoc } = useDocument();
  
  const [fileSuggestions, setFileSuggestions] = useState<DocumentSuggestion[]>([]);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(false);
  const [currentMentionValue, setCurrentMentionValue] = useState('');
  
  const [inputValue, setInputValue] = useState(input);
  const [markupValue, setMarkupValue] = useState('');

  // Use the scroll hook for auto-scroll functionality
  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  const [localStorageInput, setLocalStorageInput] = useLocalStorage('input', '');

  useEffect(() => {
    const initialVal = localStorageInput || input || '';
    setInputValue(initialVal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(inputValue);
    const mentions = parseMentionsFromMarkup(markupValue);
    onMentionsChange(mentions);
  }, [inputValue, markupValue, setLocalStorageInput, onMentionsChange]);

  // Sync with parent input prop changes
  useEffect(() => {
    if (input !== inputValue) {
      setInputValue(input);
    }
  }, [input]);

  const parseMentionsFromMarkup = (markup: string): MentionedDocument[] => {
    const mentionRegex = /@\[([^)]+)\]\\((\\S+)\\)/g;
    const mentions: MentionedDocument[] = [];
    let match;
    while ((match = mentionRegex.exec(markup)) !== null) {
      mentions.push({ title: match[1], id: match[2] });
    }
    return mentions;
  };

  const handleInputChange = (
    event: any,
    newValue: string,
    newPlainTextValue: string,
    mentions: Array<{ id: string; display: string }>
  ) => {
    setInputValue(newValue);
    setMarkupValue(newPlainTextValue);
    setInput(newValue); // Sync with parent's input state
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    const contextData: {
      activeDocumentId?: string;
      mentionedDocumentIds?: string[];
    } = {};
    
    if (currentDoc.documentId && currentDoc.documentId !== 'init') {
      contextData.activeDocumentId = currentDoc.documentId;
    }
    if (confirmedMentions.length > 0) {
      contextData.mentionedDocumentIds = confirmedMentions.map(doc => doc.id);
    }
    
    // Create message with parts array for AI SDK v5
    const message = {
      id: generateUUID(),
      role: 'user' as const,
      parts: [
        ...attachments.map((attachment) => ({
          type: 'file' as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: 'text' as const,
          text: inputValue,
        },
      ],
    };
    
    append(message);

    setAttachments([]);
    setInputValue('');
    setMarkupValue('');
    onMentionsChange([]);

    if (width && width > 768) {
      mentionInputRef.current?.focus();
    }
  }, [
    attachments,
    currentDoc.documentId,
    confirmedMentions,
    setAttachments,
    onMentionsChange,
    width,
  ]);

  // Fetch suggestions for react-mentions
  const fetchSuggestions = (
    query: string,
    callback: (data: SuggestionDataItem[]) => void
  ) => {
    if (!query) {
      setFileSuggestions([]);
      callback([]);
      return;
    }
    setIsSuggestionLoading(true);
    fetch(`/api/search?query=${encodeURIComponent(query)}`)
      .then(response => response.json())
      .then(data => {
        const suggestions = (data.results || []).map((doc: any) => ({
          id: doc.id,
          display: doc.title, // Use display for react-mentions
        }));
        setFileSuggestions(suggestions);
        callback(suggestions);
      })
      .catch(error => {
        console.error('Error searching documents:', error);
        callback([]);
      })
      .finally(() => {
        setIsSuggestionLoading(false);
      });
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    setUploadQueue(files.map((file) => file.name));

    try {
      const uploadPromises = files.map((file) => uploadFile(file));
      const uploadedAttachments = await Promise.all(uploadPromises);
      const successfullyUploadedAttachments = uploadedAttachments.filter(
        (attachment) => attachment !== undefined,
      );

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...successfullyUploadedAttachments,
      ]);
    } catch (error) {
      console.error('Error uploading files!', error);
    } finally {
      setUploadQueue([]);
    }
  }, [setAttachments]);

  // Determine styles based on theme (Keep as is)
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDarkMode(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect(); 
  }, []);

  const currentMentionStyle = isDarkMode ? mentionStyleDark : mentionStyleLight;

  const renderSuggestion = (suggestion: SuggestionDataItem, search: string, highlightedDisplay: React.ReactNode, index: number, focused: boolean) => {
    return (
      <div className={cn("px-1 py-1", { "bg-accent text-accent-foreground": focused })}>
        <span>{highlightedDisplay}</span>
      </div>
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();

      if (status === 'ready' && inputValue.trim() !== '') {
        submitForm();
      } else if (status !== 'ready') {
         toast.error('Please wait for the model to finish its response!');
      }
    }
  };

  return (
    <div className="relative w-full flex flex-col gap-4" onKeyDown={handleKeyDown}>
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 &&
        confirmedMentions.length === 0 && (
          <SuggestedActions append={append} chatId={chatId} />
        )}

      <input
        type="file"
        className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />
      
      <div className="relative">
        <MentionsInput
          inputRef={mentionInputRef}
          style={mentionInputStyle} 
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Send a message... (type @ to mention documents)"
          allowSpaceInQuery
          className={cx(className)} 
          classNames={{
            input: 'placeholder:text-muted-foreground',
          }}
          a11ySuggestionsListLabel={"Suggested documents for mention"}
          singleLine={false}
        >
          <Mention
            trigger="@"
            data={fetchSuggestions}
            renderSuggestion={renderSuggestion}
            markup="@[__display__](__id__)"
            displayTransform={(id: string, display: string) => `@${display}`}
            appendSpaceOnAdd
            className="mention-item"
            style={currentMentionStyle}
          />
        </MentionsInput>
        
        <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={inputValue}
              submitForm={submitForm}
              uploadQueue={uploadQueue}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    return true;
  },
);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => sanitizeUIMessages(messages));
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);

function PureSendButton({
  submitForm,
  input,
  uploadQueue,
}: {
  submitForm: () => void;
  input: string;
  uploadQueue: Array<string>;
}) {
  return (
    <Button
      data-testid="send-button"
      className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
      onClick={(event) => {
        event.preventDefault();
        submitForm();
      }}
      disabled={(input || '').trim().length === 0 || uploadQueue.length > 0}
    >
      <ArrowUpIcon size={14} />
    </Button>
  );
}

const SendButton = memo(PureSendButton, (prevProps, nextProps) => {
  if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length)
    return false;
  if (prevProps.input !== nextProps.input) return false;
  return true;
});
