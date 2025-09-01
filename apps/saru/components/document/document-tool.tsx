import { memo, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { FileIcon, LoaderIcon, MessageIcon, PencilEditIcon, CheckIcon, CheckCircleFillIcon, CrossIcon } from '@/components/icons';
import { toast } from 'sonner';
import { useDocument } from '@/hooks/use-document';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Lazy-load diff viewer to keep initial bundle small.
const DiffView = dynamic(() => import('./diffview').then(m => m.DiffView), {
  ssr: false,
  loading: () => <div className="p-3 text-xs text-muted-foreground">Loading diff…</div>,
});

const getActionText = (
  type: 'create' | 'stream' | 'update' | 'request-suggestions',
  tense: 'present' | 'past',
) => {
  switch (type) {
    case 'create':
      return tense === 'present' ? 'Creating document' : 'Document created';
    case 'stream':
      return tense === 'present' ? 'Streaming content for' : 'Content streamed for';
    case 'update':
      return tense === 'present' ? 'Proposing update for' : 'Update proposed for';
    case 'request-suggestions':
      return tense === 'present'
        ? 'Adding suggestions for'
        : 'Suggestions added to';
    default:
      return null;
  }
};

interface DocumentToolResultProps {
  type: 'create' | 'stream' | 'update' | 'request-suggestions';
  result: {
    id?: string;
    title?: string;
    originalContent?: string;
    newContent?: string;
    status?: string;
    error?: string;
    content?: string;
  };
  isReadonly: boolean;
}

function PureDocumentToolResult({
  type,
  result,
  isReadonly,
}: DocumentToolResultProps) {
  const { document, setDocument } = useDocument();
  const [isSaving, setIsSaving] = useState(false);
  const [isApplied, setIsApplied] = useState(() => {
    if (type === 'update' && result.id && document.documentId === result.id) {
      return document.content === result.newContent;
    }
    return false;
  });
  const [isRejected, setIsRejected] = useState(false);

  const isUpdateProposal = 
    type === 'update' && 
    result.originalContent !== undefined && 
    result.newContent !== undefined &&
    result.originalContent !== result.newContent;

  useEffect(() => {
    if (isUpdateProposal && result.id && result.newContent) {
      const event = new CustomEvent('preview-document-update', {
        detail: {
          documentId: result.id,
          newContent: result.newContent,
          originalContent: result.originalContent,
        },
      });
      window.dispatchEvent(event);
    }
  }, [isUpdateProposal, result.id, result.newContent, result.originalContent]);

  const handleApplyUpdate = useCallback(() => {
    if (type !== 'update' || !result.newContent || !result.id || isSaving) return;
    setIsSaving(true);
    // Optimistically apply locally
    setDocument(prev => ({ 
      ...prev, 
      content: result.newContent! 
    }));
    window.dispatchEvent(new CustomEvent('apply-document-update', {
      detail: { documentId: result.id, newContent: result.newContent },
    }));
    setIsApplied(true);
    // Persist to backend in background
    fetch('/api/document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: result.id, content: result.newContent }),
    })
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || response.statusText);
        }
      })
      .catch(err => {
        console.error('[DocumentToolResult] Save update error:', err);
        toast.error(`Failed to save update: ${err.message}`);
      })
      .finally(() => {
        setIsSaving(false);
      });
  }, [result.id, result.newContent, type, isSaving, setDocument]);

  const handleRejectUpdate = useCallback(() => {
    if (type !== 'update' || !result.id || !result.originalContent) return;

    setIsRejected(true);

    const event = new CustomEvent('cancel-document-update', {
      detail: {
        documentId: result.id,
      },
    });
    window.dispatchEvent(event);
    toast.info('Update proposal rejected.');
  }, [result.id, result.originalContent, type]);

  if (result.error) {
     return (
        <div className="bg-background border border-destructive/50 rounded-xl w-full max-w-md flex flex-row items-center text-sm overflow-hidden p-3 gap-3">
          <div className="text-destructive flex-shrink-0">
            <MessageIcon size={16} /> 
          </div>
          <div className="flex-grow">
            <div className="text-destructive font-medium">
              {`Failed to ${type} document${result.title ? ` "${result.title}"` : ''}`}
            </div>
            <div className="text-xs text-destructive/80 mt-0.5">
              <span className="font-mono">{result.error}</span>
            </div>
          </div>
        </div>
     )
  }

  if (isUpdateProposal) {
    return (
      <div className="bg-background border rounded-xl w-full max-w-md flex flex-col items-start text-sm overflow-hidden">
        <div className="p-3 flex flex-row gap-3 items-start w-full border-b bg-muted/30">
          <div className="text-muted-foreground mt-0.5 flex-shrink-0">
            <PencilEditIcon size={16}/>
          </div>
          <div className="text-left flex-grow text-foreground">
            {`${getActionText(type, 'past')} "${result.title ?? 'document'}"`}
            {result.status && <span className="text-xs text-muted-foreground ml-1">({result.status})</span>}
          </div>
        </div>

        {!isApplied && !isRejected ? (
          <>
        <div className="p-3 w-full max-h-60 overflow-y-auto text-xs">
          <DiffView 
            oldContent={result.originalContent ?? ''} 
            newContent={result.newContent ?? ''} 
          />
        </div>
            <div className="p-2 border-t w-full flex justify-end bg-muted/30 gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleRejectUpdate}
            disabled={isSaving || isApplied || isRejected}
            className="text-xs flex items-center gap-1.5"
          >
            <CrossIcon size={14} />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleApplyUpdate}
            disabled={isSaving || isApplied || isRejected}
            className="text-xs flex items-center gap-1.5"
          >
            <CheckIcon size={14} />
            {isSaving ? 'Saving…' : 'Accept'}
          </Button>
        </div>
          </>
        ) : (
          isApplied ? (
            <div className="flex items-center gap-2 p-3 w-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircleFillIcon size={16} />
              <span className="text-sm">Update applied to document.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 w-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <CrossIcon size={16} />
              <span className="text-sm">Update proposal rejected.</span>
            </div>
          )
        )}
      </div>
    );
  }

  const successMessage = 
    type === 'create' 
      ? (result.content || 'Document initialized successfully.') 
      : type === 'stream' 
        ? (result.content || 'Content generation completed.') 
        : 'Operation successful.';

  const SuccessIcon = CheckCircleFillIcon;

  return (
    <div className="bg-background border rounded-xl w-full max-w-md flex flex-row items-center text-sm overflow-hidden p-3 gap-3">
       <div className="text-green-600 flex-shrink-0">
         <SuccessIcon size={16}/>
       </div>
       <div className="flex-grow">
         <div className="text-foreground">
           {`${getActionText(type, 'past')} ${result.title ? `"${result.title}"` : '(active document)'}`}
         </div>
         <div className="text-xs text-muted-foreground mt-0.5">
           {successMessage}
         </div>
       </div>
    </div>
  );
}

export const DocumentToolResult = memo(PureDocumentToolResult);

interface DocumentToolCallProps {
  type: 'create' | 'stream' | 'update' | 'request-suggestions';
  args: { title?: string };
  isReadonly: boolean;
}

function PureDocumentToolCall({
  type,
  args = { title: '' },
  isReadonly,
}: DocumentToolCallProps) {
  const { document: localDocument } = useDocument();
  const docTitle = localDocument?.title ?? '';

  const titleArg = args.title ?? '';
  const displayTitle = type === 'create' && docTitle.trim()
    ? docTitle
    : titleArg.trim();

  const CallIcon = 
    type === 'create' ? FileIcon :
    type === 'stream' ? MessageIcon :
    type === 'update' ? PencilEditIcon :
    type === 'request-suggestions' ? MessageIcon :
    LoaderIcon;

  return (
    <div
      className="bg-background border rounded-xl w-full max-w-md flex flex-row items-center justify-between gap-3 text-sm overflow-hidden"
    >
      <div className="p-3 flex flex-row gap-3 items-center w-full bg-muted/30">
        <div className="text-muted-foreground flex-shrink-0">
          <CallIcon size={16}/>
        </div>
        <div className="text-left flex-grow text-foreground">
          {`${getActionText(type, 'present')}`}{' '}
          {displayTitle ? `"${displayTitle}"` : '(active document)'}
        </div>
        <div className="animate-spin text-muted-foreground flex-shrink-0">
            <LoaderIcon size={16} />
        </div>
      </div>
    </div>
  );
}

export const DocumentToolCall = memo(PureDocumentToolCall);
