'use client';

import { useState, useEffect, useRef } from 'react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, X, ArrowUpIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {Markdown} from '@/components/markdown'

interface AIChatWidgetProps {
  context: string;
  title: string;
  author: string;
  date: string;
}

const SAMPLE_PROMPT: Array<string> = [
  "Summarize this document",
  "Explain the main concepts",
  "What are the key takeaways?",
];

export default function AIChatWidget({ context, title, author, date }: AIChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleNewChat = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setInput('');
    setError(null);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setError(null);
    setLoading(true);
    // abort any previous
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input };
    // Build next messages array and use for conversation
    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setInput('');
    const conversation = nextMessages;
    let res: Response;
    try {
      res = await fetch('/api/blog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, context, title, author, date }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError('Network error');
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      setError('Failed to load AI response');
      setLoading(false);
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      setLoading(false);
      return;
    }
    const decoder = new TextDecoder();
    let done = false;
    const assistantId = Date.now().toString() + '-assistant';
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant' as const, content: '' }]);
    while (!done) {
      try {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg
            )
          );
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
        break;
      }
    }
    setLoading(false);
  };

  const submitMessage = async (content: string): Promise<void> => {
    if (!content.trim() || loading) return;
    setError(null);
    setLoading(true);
    // abort any previous
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const userMessage = { id: Date.now().toString(), role: 'user' as const, content };
    // Build next messages array and use for conversation
    const nextMessages = [...messagesRef.current, userMessage];
    setMessages(nextMessages);
    setInput('');
    const conversation = nextMessages;
    let res: Response;
    try {
      res = await fetch('/api/blog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, context, title, author, date }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError('Network error');
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(text);
      setError('Failed to load AI response');
      setLoading(false);
      return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
      setLoading(false);
      return;
    }
    const decoder = new TextDecoder();
    let done = false;
    const assistantId = Date.now().toString() + '-assistant';
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant' as const, content: '' }]);
    while (!done) {
      try {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value);
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg
            )
          );
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
        break;
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [messages, open]);

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="fixed bottom-4 right-4 z-50"
          >
            <Button
              className="rounded-full px-6 py-3 shadow-lg" 
              onClick={e => { e.stopPropagation(); setOpen(true); }}
            >
              Ask Leo
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="fixed bottom-4 right-4 z-50 w-[400px] h-[500px] bg-background rounded-2xl shadow-lg border border-border overflow-hidden"
            >
              <div className="flex flex-col h-full overflow-hidden">

                <header className="flex sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-border items-center px-3 h-[45px] gap-2 transition-all duration-200">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={handleNewChat}
                    title="New Chat"
                  >
                    <Plus className="size-4" />
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => setOpen(false)}
                    title="Close Chat"
                  >
                    <X className="size-4" />
                  </Button>
                </header>

                <div ref={messagesContainerRef} className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4">
                  {messages.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      className="flex flex-col items-center justify-center flex-1 px-4"
                    >
                      <div className="w-full max-w-2xl mx-auto text-center">
                        <div className="mb-6">
                          <motion.div 
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                            className="size-12 flex items-center justify-center rounded-full ring-1 ring-border bg-background overflow-hidden relative mx-auto mb-4"
                          >
                            <img
                              src="/images/leopardprintbw.svg"
                              alt="Snow Leopard"
                              className="object-cover dark:invert"
                            />
                          </motion.div>
                          <motion.h3 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3, duration: 0.3 }}
                            className="text-lg font-semibold mb-2"
                          >
                            How can I help you with this document?
                          </motion.h3>
                        </div>
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                          className="flex flex-wrap gap-2 justify-center"
                        >
                          {SAMPLE_PROMPT.map((prompt, index) => (
                            <motion.div
                              key={prompt}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
                            >
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-sm px-4 py-2 h-auto rounded-full hover:bg-primary hover:text-primary-foreground transition-colors" 
                                onClick={() => submitMessage(prompt)}
                              >
                                {prompt}
                              </Button>
                            </motion.div>
                          ))}
                        </motion.div>
                      </div>
                    </motion.div>
                  ) : (
                    messages.map(message => (
                      <div
                        key={message.id}
                        className="w-full mx-auto max-w-3xl px-4 group/message"
                        data-role={message.role}
                      >
                        <div className="flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit">
                          {message.role === 'assistant' && (
                            <div className="size-8 flex items-center justify-center rounded-full ring-1 shrink-0 ring-border bg-background overflow-hidden relative">
                              <img
                                src="/images/leopardprintbw.svg"
                                alt="Snow Leopard"
                                className="object-cover dark:invert"
                              />
                            </div>
                          )}
                          <div className="flex flex-col gap-4 w-full">
                            <div data-testid="message-content" className="flex flex-row gap-2 items-start">
                              <div className={message.role === 'user' ? 'bg-primary text-primary-foreground px-3 py-2 rounded-xl' : ''}>
                                <Markdown>
                                {message.content}
                                </Markdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} className="shrink-0 min-w-[24px] min-h-[24px]" />
                </div>

                <div className="p-4 border-t border-zinc-200  dark:border-zinc-700 relative">
                
                  <form onSubmit={handleSubmit}>
                    <div className="relative w-full flex flex-col gap-4">
                      <Textarea
                        data-testid="multimodal-input"
                        placeholder="Send a message..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="px-3 py-2 min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700"
                        rows={2}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
                        <Button
                          type="submit"
                          data-testid="send-button"
                          className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
                          disabled={!input.trim() || loading}
                        >
                          <ArrowUpIcon size={14} />
                        </Button>
                      </div>
                    </div>
                  </form>
                  {error && <div className="text-xs text-destructive text-center mb-2">{error}</div>}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
} 