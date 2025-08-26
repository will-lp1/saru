'use client';

import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { RotateCcw, Clock, Loader2 } from 'lucide-react';
import { format, formatDistance, isToday, isYesterday, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

import type { Document } from '@snow-leopard/db';

type VersionData = {
  id: string;
  content: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isCurrent: boolean;
  diffContent?: string;
};
import { versionCache } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { useDocument } from '@/hooks/use-document';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VersionHeaderProps {
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  documents: Array<Document | VersionData> | undefined;
  currentVersionIndex: number;
}

export const VersionHeader = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
}: VersionHeaderProps) => {
  const { document, setDocument } = useDocument();
  const { mutate } = useSWRConfig();
  const [isMutating, setIsMutating] = useState(false);
  
  const handleRestoreVersion = useCallback(async () => {
    if (!documents || currentVersionIndex < 0 || currentVersionIndex >= documents.length) {
      toast.error('Invalid version selected');
      return;
    }

    setIsMutating(true);
    try {
      const versionToRestore = documents[currentVersionIndex];
      const content = versionToRestore.content;
      const title = versionToRestore.title;
      
      const response = await fetch(`/api/document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: document.documentId,
          content: content,
          title: title,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to restore version: ${response.status}`);
      }
      
      await mutate(`/api/document?id=${document.documentId}`);
      
      setDocument(current => ({
        ...current,
        content: content || '',
        title: title || current.title
      }));
      
      handleVersionChange('latest');
      
      try {
        await versionCache.invalidateVersions(document.documentId);
        console.log(`[Version] Invalidated cache after restore for ${document.documentId}`);
      } catch (cacheError) {
        console.warn(`[Version] Failed to invalidate cache:`, cacheError);
      }
      
      const event = new CustomEvent('version-restored', {
        detail: {
          documentId: document.documentId,
          content: content,
          title: title
        }
      });
      window.dispatchEvent(event);
      
      toast.success('Version restored successfully');
    } catch (error) {
      console.error('[Version] Error restoring version:', error);
      toast.error('Failed to restore version');
    } finally {
      setIsMutating(false);
    }
  }, [documents, currentVersionIndex, document.documentId, setDocument, handleVersionChange, mutate]);
  
  if (!documents || documents.length === 0) return null;

  const formatVersionLabel = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    
    const days = differenceInDays(new Date(), date);
    if (days < 7) return format(date, 'EEE');
    if (days < 60) return format(date, 'MMM d');
    return format(date, 'MMM yyyy');
  };
  
  const formatVersionTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const currentDoc = documents[currentVersionIndex];
  if (!currentDoc) return null; 

  const createdAt = 'version' in currentDoc ? currentDoc.createdAt : currentDoc.createdAt;
  const dateString = formatVersionLabel(new Date(createdAt));
  const timeString = formatVersionTime(new Date(createdAt));
  const relativeTimeString = formatDistance(new Date(createdAt), new Date(), { addSuffix: true });
  
  const versionNumber = 'version' in currentDoc ? currentDoc.version : currentVersionIndex + 1;

  return (
    <TooltipProvider>
      <div
        className="relative border-b border-border backdrop-blur-sm overflow-hidden"
      >
        <div className="px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-primary/90 font-medium">
                <span className="rounded-full bg-primary/10 size-5 flex items-center justify-center text-[10px] text-primary">
                  {versionNumber}
                </span>
                <span>
                  {dateString}
                </span>
                <span className="text-xs text-muted-foreground">
                  {timeString}
                </span>
              </div>
              
              <div className="flex items-center text-xs text-muted-foreground gap-1">
                <Clock className="size-3" />
                <span>{relativeTimeString}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs gap-1.5 h-7 px-2.5"
                    onClick={handleRestoreVersion}
                    disabled={isMutating}
                  >
                    {isMutating ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    <span>Restore</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Make this version the current version
                </TooltipContent>
              </Tooltip>
              
              <Button
                variant="secondary"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => handleVersionChange('latest')}
              >
                Exit History
              </Button>
            </div>
        </div>
      </div>
    </TooltipProvider>
  );
}; 