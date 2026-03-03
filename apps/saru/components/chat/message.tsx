"use client";

import type { UIMessage } from "ai";
import cx from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import React, { memo, useRef, useState, useEffect } from "react";
import {
  DocumentToolCall,
  DocumentToolResult,
  type DocumentToolResultProps,
} from "@/components/document/document-tool";
import { Markdown } from "../markdown";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import equal from "fast-deep-equal";
import { cn } from "@/lib/utils";
import { MessageReasoning } from "./message-reasoning";
import Image from "next/image";
import { UseChatHelpers } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { useDocument } from "@/hooks/use-document";

const mentionStyleLight: React.CSSProperties = {
  backgroundColor: '#dbeafe',
  padding: '1px 2px',
  borderRadius: '0.25rem',
  fontWeight: 500,
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
  cursor: 'pointer',
};

const mentionStyleDark: React.CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.2)',
  padding: '1px 2px',
  borderRadius: '0.25rem',
  fontWeight: 500,
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
  cursor: 'pointer',
};

function MentionChip({ title, id }: { title: string; id: string }) {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/documents/${id}`)}
      onKeyDown={(e: any) => e.key === 'Enter' && router.push(`/documents/${id}`)}
      style={isDark ? mentionStyleDark : mentionStyleLight}
    >
      @{title}
    </span>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content.includes('@[')) return <Markdown>{content}</Markdown>;

  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of content.matchAll(/@\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (match.index! > last) parts.push(<Markdown key={last}>{content.slice(last, match.index)}</Markdown>);
    parts.push(<MentionChip key={match.index} title={match[1]} id={match[2]} />);
    last = match.index! + match[0].length;
  }
  if (last < content.length) parts.push(<Markdown key={last}>{content.slice(last)}</Markdown>);
  return <>{parts}</>;
}

const PurePreviewMessage = ({
  chatId,
  message,
  messages,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
}: {
  chatId: string;
  message: UIMessage;
  messages: UIMessage[];
  isLoading: boolean;
  setMessages: (
    messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])
  ) => void;
  regenerate: UseChatHelpers<UIMessage>["regenerate"];
  isReadonly: boolean;
}) => {
  const { document } = useDocument();
  const dispatchedKeysRef = useRef<Set<string>>(new Set());
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const reasoningPart = message.parts?.find(
    (part) => part.type === "reasoning"
  );
  const reasoningText = reasoningPart ? reasoningPart.text : "";

  const textParts = message.parts?.filter((part) => part.type === "text") || [];
  const textContent = textParts.map((part) => part.text).join("");

  const toolParts =
    message.parts?.filter((part) => part.type?.startsWith("tool-")) || [];

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            "flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
            "group-data-[role=user]/message:w-fit",
            {
              "justify-end": message.role === "user" && mode !== "edit",
              "justify-start": message.role === "assistant",
            }
          )}
        >
          {message.role === "assistant" && (
            <div className="size-8 flex items-center justify-center rounded-full ring-1 shrink-0 ring-border bg-background overflow-hidden relative">
              <Image
                src="/images/leopardprintbw.svg"
                alt="Saru"
                fill
                className="object-cover dark:invert"
                style={{ transform: "scale(2.5)" }}
              />
            </div>
          )}

          <div className="flex flex-col gap-4 w-full">
            {reasoningText && (
              <MessageReasoning
                isLoading={isLoading}
                reasoningText={reasoningText}
              />
            )}

            {(textContent || reasoningText) && (
              <>
                {mode === "view" && (
                  <div
                    data-testid="message-content"
                    className="flex flex-row gap-2 items-start"
                  >
                    <div
                      className={cn("flex flex-col gap-4", {
                        "bg-primary text-primary-foreground px-3 py-2 rounded-xl":
                          message.role === "user",
                      })}
                    >
                      {typeof textContent === "string" ? (
                        <MessageContent content={textContent} />
                      ) : (
                        <pre className="text-sm text-red-500">
                          Error: Invalid message content format
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {mode === "edit" && message.role === "user" && (
                  <div className="flex w-full flex-row items-start gap-3">
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {message.parts?.map((part, index) => {
              // Maintain original stream order by iterating parts directly
              if (part.type === "tool-webSearch") {
                if (part.state === "output-available" && "output" in part) {
                  const result = (part as any).output;
                  const input = "input" in part ? (part as any).input : {};
                  const query = input?.query || "";
                  const results = result?.results || [];
                  return (
                    <WebSearchResult
                      key={`tool-webSearch-${index}`}
                      query={query}
                      results={results}
                    />
                  );
                }

                if (
                  (part as any).state === "input-streaming" ||
                  (part as any).state === "input-available"
                ) {
                  const input = "input" in part ? (part as any).input : {};
                  const query = input?.query || "";
                  return (
                    <div
                      key={`tool-webSearch-loading-${index}`}
                      className="bg-background border rounded-xl w-full max-w-md p-3 text-sm animate-pulse"
                    >
                      Searching web for &quot;{query}&quot;...
                    </div>
                  );
                }
                return null;
              }

              if (part.type?.startsWith("tool-") && "state" in part) {
                const p: any = part as any;
                let actionType: "create" | "stream" | "update" | "request-suggestions" = "update";
                if (p.type === "tool-updateDocument") actionType = "update";
                else if (p.type === "tool-createDocument") actionType = "create";
                else if (p.type === "tool-streamingDocument") actionType = "stream";

                if (p.state === "output-available" && "output" in p) {
                  const result = p.output;
                  if (result && typeof result === "object") {
                    return (
                      <DocumentToolResult
                        key={`tool-result-${index}`}
                        type={actionType}
                        result={{ ...result, toolCallId: p.toolCallId } as DocumentToolResultProps['result']}
                        isReadonly={isReadonly}
                        chatId={chatId}
                        messageId={message.id}
                      />
                    );
                  }
                }

                if (p.state === "streaming" || p.state === "input-available") {
                  const input = "input" in p ? p.input : {};
                  return (
                    <DocumentToolCall
                      key={`tool-call-${index}`}
                      type={actionType}
                      args={input as any}
                      isReadonly={isReadonly}
                    />
                  );
                }
              }
              return null;
            })}

            {!isReadonly && mode === 'view' && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                messages={messages}
                isLoading={isLoading}
                setMode={setMode}
                regenerate={regenerate}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    return false;
  }
);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          }
        )}
      >
        <div className="size-8 flex items-center justify-center rounded-full ring-1 shrink-0 ring-border overflow-hidden relative">
          <Image
            src="/images/leopardprintbw.svg"
            alt="Saru"
            fill
            className="object-cover dark:invert"
            style={{ transform: "scale(2.5)" }}
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function WebSearchResult({
  query,
  results,
}: {
  query: string;
  results: any[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-background border rounded-xl w-full max-w-md p-4 text-sm">
      <div className="flex items-center justify-between">
        <span>Search completed for &quot;{query}&quot;</span>
        <button
          onClick={() => setOpen(!open)}
          className="text-blue-600 hover:underline"
        >
          {open ? "Hide sources" : `View ${results.length} sources`}
        </button>
      </div>
      {open && (
        <ul className="list-disc pl-5 mt-2 space-y-1 max-h-60 overflow-auto">
          {results.map((item, idx) => (
            <li key={idx}>
              {item.title ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <span>{item.url}</span>
              )}
              {item.content && <span>: {item.content}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
