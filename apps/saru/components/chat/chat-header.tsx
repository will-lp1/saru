'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';
import Image from 'next/image';
import useSWR from 'swr';

import { ModelSelector } from '@/components/chat/model-selector';
import { Button } from '@/components/ui/button';
import { PlusIcon, ClockRewind, MessageIcon } from '../icons';
import { useSidebar } from '../ui/sidebar';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { useDocument } from '@/hooks/use-document';
import { fetcher } from '@/lib/utils';
import type { Chat } from '@saru/db';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

function PureChatHeader({
  chatId,
  selectedModelId,
  isReadonly,
  className,
  onModelChange,
}: {
  chatId: string;
  selectedModelId: string;
  isReadonly: boolean;
  className?: string;
  onModelChange: (newModelId: string) => void;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 768;
  const isCompact = windowWidth < 1024;
  const { handleResetChat, isCreatingChat } = useDocument();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Fetch recent chat history for the dropdown menu
  const { data: history, isLoading: isHistoryLoading } = useSWR<Array<Chat & { document_context?: any }>>('/api/history', fetcher, {
    fallbackData: [],
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1 minute
  });
  
  // Get recent chats - limited to 5
  const recentChats = history && history.length > 0 
    ? history.slice(0, 5)
    : [];

  return (
    <header
      className={cn(
        'flex sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b border-r border-border items-center px-3 h-[45px] gap-2 transition-all duration-200',
        className,
      )}
    >
      <Button
        variant="outline"
        className="h-8 flex items-center justify-center dark:hover:bg-zinc-700 w-8 p-0 border-r border-border"
        onClick={handleResetChat}
        disabled={isCreatingChat}
        title="New Chat"
      >
        {isCreatingChat ? (
          <svg className="animate-spin size-4 text-muted-foreground" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <PlusIcon />
        )}
      </Button>

      {!isReadonly && mounted && (
        <div className="transition-all duration-200 min-w-0 flex-shrink">
          <ModelSelector
            selectedModelId={selectedModelId}
            className={cn("ml-0", {
              'w-[140px] md:px-2 md:h-[34px]': isCompact,
              'w-[180px] md:px-3 md:h-[34px]': !isCompact
            })}
            onModelChange={onModelChange}
          />
        </div>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-8 ml-auto text-muted-foreground hover:text-foreground"
          >
            <ClockRewind size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Recent Conversations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {recentChats.length === 0 ? (
            <DropdownMenuItem disabled className="py-2 px-3 text-center">
              No recent conversations
            </DropdownMenuItem>
          ) : (
            recentChats.map((chat) => (
              <DropdownMenuItem 
                key={chat.id}
                onClick={() => {
                  // Dispatch an event to load this chat in the current document view
                  window.dispatchEvent(new CustomEvent('load-chat', { 
                    detail: { chatId: chat.id } 
                  }));
                }}
                className="py-2 px-3"
              >
                <div className="flex flex-col w-full overflow-hidden">
                  <span className="truncate font-medium text-sm">{chat.title}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(chat.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: new Date(chat.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                      })}
                    </span>
                  </div>
                  {(chat.document_context?.active || (chat.document_context?.mentioned && chat.document_context.mentioned.length > 0)) && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/50 text-xs flex flex-col gap-1 overflow-hidden">
                      {chat.document_context.active && (
                        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                          <span className="font-medium text-foreground/80 flex-shrink-0">Active:</span>
                          <Link 
                            href={`/documents/${chat.document_context.active}`}
                            className="truncate hover:underline text-blue-500 dark:text-blue-400"
                            onClick={(e) => e.stopPropagation()} 
                            title={chat.document_context.activeTitle || chat.document_context.active}
                          >
                            {chat.document_context.activeTitle || chat.document_context.active}
                          </Link>
                        </div>
                      )}
                      {chat.document_context.mentioned && chat.document_context.mentioned.length > 0 && (
                        <div className="flex items-start gap-1.5 text-muted-foreground">
                          <span className="font-medium text-foreground/80 flex-shrink-0 pt-px">Mentioned:</span>
                          <div className="flex flex-wrap gap-x-2 gap-y-1 overflow-hidden">
                            {chat.document_context.mentioned.map((docId: string, index: number) => (
                              <Link 
                                key={docId}
                                href={`/documents/${docId}`}
                                className="truncate hover:underline text-blue-500 dark:text-blue-400"
                                onClick={(e) => e.stopPropagation()} // Prevent dropdown item click
                                title={chat.document_context.mentionedTitles?.[index] || docId}
                              >
                                {chat.document_context.mentionedTitles?.[index] || docId}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* GitHub Link */}
      <Button
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        asChild
      >
        <Link
          href="https://github.com/will-lp1/saru"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image 
            src="/images/github-logo.png" 
            alt="Github" 
            width={16} 
            height={16}
            className="dark:invert"
          />
        </Link>
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});