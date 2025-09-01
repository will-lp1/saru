'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDocument } from '@/hooks/use-document';

export type DataStreamDelta = {
  type:
    | 'text-delta'
    | 'title'
    | 'id'
    | 'clear'
    | 'finish'
    | 'documentUpdate'
    | 'force-save';
  content: string;
};

// Define interface for metadata - remove suggestion fields
interface StreamMetadata {
  originalContent?: string; 
  [key: string]: any;
}

export function DataStreamHandler({ id }: { id: string }) {
  const router = useRouter();
  const { data: dataStream } = useChat({ id });
  const { document, setDocument } = useDocument();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    (newDeltas as DataStreamDelta[]).forEach((delta: DataStreamDelta) => {
      setDocument((currentDocument) => {
        if (!currentDocument) {
          return {
            documentId: 'init',
            title: '',
            content: '',
            status: 'streaming'
          };
        }

        switch (delta.type) {
          case 'text-delta':
            if (typeof window !== 'undefined' && currentDocument.documentId) {
              window.dispatchEvent(
                new CustomEvent('editor:stream-text', {
                  detail: {
                    documentId: currentDocument.documentId,
                    content: delta.content,
                  },
                }),
              );
            }
            return currentDocument;

          case 'id':
            console.log(`[DataStreamHandler] Received ID delta: ${delta.content}. Updating artifact state.`);
            const newDocId = delta.content;
            console.log(`[DataStreamHandler] Navigating to /documents/${newDocId}`);
            router.push(`/documents/${newDocId}`);
            return {
              ...currentDocument,
              documentId: newDocId,
            };

          case 'force-save':
            if (currentDocument.documentId && currentDocument.documentId !== 'init') {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('editor:force-save-document', {
                  detail: { documentId: currentDocument.documentId }
                }));
              }
            }
            return currentDocument;

          case 'finish':
            if (currentDocument.status === 'streaming' && currentDocument.documentId !== 'init') {
                console.log(`[DataStreamHandler] Dispatching creation-stream-finished for ${currentDocument.documentId}`);
                window.dispatchEvent(new CustomEvent('editor:creation-stream-finished', {
                    detail: { documentId: currentDocument.documentId }
                }));
            }
            return {
              ...currentDocument,
              status: 'idle',
            };

          case 'documentUpdate':
            try {
              const updateData = JSON.parse(delta.content as string);
              console.log('[DataStreamHandler] Received artifactUpdate, dispatching to editor:', updateData);
              
              if (typeof window !== 'undefined') {
                console.log('[DataStreamHandler] Window context confirmed. Attempting to dispatch editor:stream-data...');
                try {
                  window.dispatchEvent(new CustomEvent('editor:stream-data', {
                    detail: { type: 'documentUpdate', content: delta.content }
                  }));
                  console.log('[DataStreamHandler] Dispatched editor:stream-data successfully.', { detail: { type: 'documentUpdate', content: delta.content } });
                } catch (dispatchError) {
                  console.error('[DataStreamHandler] Error dispatching editor:stream-data:', dispatchError);
                }
              } else {
                console.warn('[DataStreamHandler] Window context not found. Cannot dispatch event.');
              }
            } catch (error) {
              console.error('[DataStreamHandler] Error parsing documentUpdate content:', error);
            }
            return currentDocument;

          default:
            return currentDocument;
        }
      });
    });
  }, [dataStream, setDocument, document, router]);

  return null;
}
