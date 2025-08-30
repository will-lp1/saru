'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo, Suspense, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import type { Document } from '@snow-leopard/db';
import { generateUUID } from '@/lib/utils';
import { DocumentActions } from '@/components/document/actions';
import { VersionRail } from '@/components/document/version-rail';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { useDocument } from '@/hooks/use-document';
import { AiSettingsMenu } from '../ai-settings-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { SaveState, SaveStatus } from '@/lib/editor/save-plugin';
import type { User } from '@/lib/auth';
import { PublishSettingsMenu } from '@/components/publish-settings-menu';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentVersions } from '@/hooks/use-document-versions';

const Editor = dynamic(() => import('@/components/document/editor').then(mod => mod.Editor), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

const EditorSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-6 bg-muted rounded w-3/4"></div>
    <div className="h-4 bg-muted rounded w-full"></div>
    <div className="h-4 bg-muted rounded w-5/6"></div>
    <div className="h-4 bg-muted rounded w-full"></div>
    <div className="h-4 bg-muted rounded w-1/2"></div>
  </div>
);

type AlwaysVisibleArtifactProps = {
  chatId: string;
  initialDocumentId: string;
  initialDocuments: Document[];
  showCreateDocumentForId?: string;
  user: User;
};


export function AlwaysVisibleArtifact({
  chatId,
  initialDocumentId,
  initialDocuments = [],
  showCreateDocumentForId,
  user
}: AlwaysVisibleArtifactProps) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveStatus>('idle');
  const { document, setDocument } = useDocument();
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [isRenamingDocument, setIsRenamingDocument] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'edit' | 'diff'>('edit');

  const { versions: swrVersions, isLoading: versionsLoading, mutate: mutateVersions } = useDocumentVersions(initialDocumentId, user?.id);
  const [documents, setDocuments] = useState<Document[]>(swrVersions);

  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(swrVersions.length > 0 ? swrVersions.length - 1 : -1);

  useEffect(() => {
    const wasAtLatest =
      currentVersionIndex === -1 || currentVersionIndex === documents.length - 1;

    setDocuments(swrVersions);

    if (swrVersions.length === 0) {
      setCurrentVersionIndex(-1);
      return;
    }

    if (wasAtLatest || currentVersionIndex >= swrVersions.length) {
      setCurrentVersionIndex(swrVersions.length - 1);
    }
  }, [swrVersions]);


  const renameDocument = async (newTitle: string) => {
    if (isRenamingDocument || !document.documentId || document.documentId === 'init') return;

    if (!newTitle.trim()) {
      toast.error('Document title cannot be empty');
      return;
    }

    setIsRenamingDocument(true);

    try {
      const response = await fetch(`/api/document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: document.documentId,
          title: newTitle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error during rename' }));
        throw new Error(`Failed to rename document: ${errorData.error || response.statusText}`);
      }

      const updatedDocumentData = await response.json(); 

      setDocument(current => ({
        ...current,
        title: updatedDocumentData?.title || newTitle
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-renamed', {
          detail: {
            documentId: document.documentId,
            newTitle: updatedDocumentData?.title || newTitle
          }
        }));
      }

      toast.success('Document renamed', {
        duration: 2000
      });
    } catch (error: any) {
      console.error('Error renaming document:', error);
      toast.error('Failed to rename document', {
        description: error.message
      });
    } finally {
      setIsRenamingDocument(false);
    }
  };

  const createDocument = async (params: { title: string; content: string; chatId: string | null; navigateAfterCreate?: boolean; providedId?: string }) => {
    setIsCreatingDocument(true);
    
    try {
      const documentId = params.providedId || generateUUID();
      
      const response = await fetch('/api/document', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: documentId,
          title: params.title,
          content: params.content,
          kind: 'text',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create document');
      }
      
      const newDocument = await response.json();
      
      setDocument(curr => ({
        ...curr,
        documentId: documentId,
        title: params.title,
        content: params.content,
        status: 'idle',
      }));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-created', {
          detail: {
            document: newDocument
          }
        }));
      }
      
      if (params.navigateAfterCreate) {
        router.push(`/documents/${documentId}`);
      }
      
      return newDocument;
    } catch (error) {
      console.error('[useDocumentUtils] Error creating document:', error);
      toast.error('Failed to create document');
      return null;
    } finally {
      setIsCreatingDocument(false);
    }
  };


  const currentDocument = useMemo(() => {
    if (currentVersionIndex >= 0 && currentVersionIndex < documents.length) {
      return documents[currentVersionIndex];
    }
    return null;
  }, [documents, currentVersionIndex]);

  const latestDocument = useMemo(() => {
      if (documents && documents.length > 0) {
          return documents[documents.length - 1];
      }
      return null;
  }, [documents]);

  useEffect(() => {
    startTransition(() => {
        const docs = initialDocuments || [];
        setDocuments(docs);
        const initialIndex = docs.length > 0 ? docs.length - 1 : -1;
        setCurrentVersionIndex(initialIndex);
        setMode('edit');

        const docToUse = docs[initialIndex];

        if (docToUse) {
            setDocument({
                documentId: docToUse.id,
                title: docToUse.title,
                content: docToUse.content ?? '',
                status: 'idle'
            });
            setNewTitle(docToUse.title);
        } else if (initialDocumentId === 'init' || showCreateDocumentForId) {
            setDocument({
                documentId: 'init',
                title: 'Document',
                content: '',
                status: 'idle'
            });
            setNewTitle('Document');
        }
    });

  }, [initialDocumentId, initialDocuments, setNewTitle, startTransition, setDocument]);

  useEffect(() => {
    const handleDocumentRenamed = (event: CustomEvent) => {
      if (!event.detail) return;
      const { documentId: renamedDocId, newTitle: updatedTitle } = event.detail;

      setDocuments(prevDocs =>
          prevDocs.map(doc =>
              doc.id === renamedDocId ? { ...doc, title: updatedTitle } : doc
          )
      );

      if (renamedDocId === document.documentId) {
        if (editingTitle && newTitle !== updatedTitle) {
          setNewTitle(updatedTitle);
        }
      }
    };

    const handleVersionFork = async (event: CustomEvent) => {
      const { originalDocumentId, versionIndex, forkFromTimestamp } = event.detail;
      
      if (originalDocumentId !== document.documentId) return;
      
      console.log('[DocumentWorkspace] Handling version fork from index', versionIndex, 'timestamp', forkFromTimestamp);
      
      try {
        // Get the current document title for naming the fork
        const currentDoc = documents[documents.length - 1];
        const forkTitle = `${currentDoc?.title || 'Document'} (Fork)`;
        
        const response = await fetch('/api/document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'fork',
            originalDocumentId,
            forkFromTimestamp,
            versionIndex,
            newTitle: forkTitle,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Fork failed: ${errorData.error || response.statusText}`);
        }
        
        const forkResult = await response.json();
        console.log('[DocumentWorkspace] Fork successful:', forkResult);
        
        // Navigate to the new forked document
        toast.success(`Forked to new document: ${forkTitle}`);
        router.push(`/documents/${forkResult.newDocumentId}`);
        
      } catch (error: any) {
        console.error('[DocumentWorkspace] Version fork failed:', error);
        toast.error(`Failed to fork document: ${error.message}`);
      }
    };

    window.addEventListener('document-renamed', handleDocumentRenamed as unknown as EventListener);
    window.addEventListener('version-fork', handleVersionFork as unknown as EventListener);
    

    return () => {
      window.removeEventListener('document-renamed', handleDocumentRenamed as unknown as EventListener);
      window.removeEventListener('version-fork', handleVersionFork as unknown as EventListener);
    };
  }, [newTitle, editingTitle, setDocuments, document.documentId, user?.id, mutateVersions]);

  const handleDocumentUpdate = (updatedFields: Partial<Document>) => {
      setDocuments(prevDocs =>
          prevDocs.map(doc => {
              if (doc.id === updatedFields.id) {
                  return { ...doc, ...updatedFields };
              }
              return doc;
          })
      );

  };

  const handleEditTitle = useCallback(() => {
    if (!latestDocument) return;
    setNewTitle(latestDocument.title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 50);
  }, [latestDocument]);

  const handleSaveTitle = useCallback(async () => {
    if (!latestDocument) return;
    const trimmedNewTitle = newTitle.trim();
    if (trimmedNewTitle && trimmedNewTitle !== latestDocument.title) {
      const originalTitle = latestDocument.title;
      const originalDocuments = [...documents];
      
      setDocuments(prevDocs => prevDocs.map(doc => 
        doc.id === latestDocument.id ? { ...doc, title: trimmedNewTitle } : doc
      ));

      try {
        await renameDocument(trimmedNewTitle);
      } catch (error) {
        toast.error("Failed to rename document.");
        setDocuments(originalDocuments);
        console.error("Rename failed:", error);
      } finally {
        setEditingTitle(false);
      }
    } else {
       setEditingTitle(false);
       if (!trimmedNewTitle) setNewTitle(latestDocument.title);
    }
  }, [newTitle, latestDocument, documents, renameDocument, setDocuments]);

  const handleCancelEditTitle = useCallback(() => {
    if (!latestDocument) return;
    setEditingTitle(false);
    setNewTitle(latestDocument.title);
  }, [latestDocument]);

  const handleVersionChange = useCallback((type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (documents.length <= 1 && (type === 'next' || type === 'prev' || type === 'toggle')) return;

    startTransition(() => {
        if (type === 'latest') {
            setCurrentVersionIndex(documents.length - 1);
            setMode('edit');
            return;
        }

        if (type === 'toggle') {
            const nextMode = mode === 'edit' ? 'diff' : 'edit';
            setMode(nextMode);
            if (nextMode === 'edit') {
                setCurrentVersionIndex(documents.length - 1);
            }
            return;
        }

        setMode('diff');
        if (type === 'prev') {
            setCurrentVersionIndex((index) => Math.max(0, index - 1));
        } else if (type === 'next') {
            setCurrentVersionIndex((index) => Math.min(documents.length - 1, index + 1));
        }
    });
  }, [documents, mode, startTransition]);

  const handleVersionChangeByIndex = useCallback((index: number) => {
    if (index < 0 || index >= documents.length) return;
    setCurrentVersionIndex(index);
    setMode(index === documents.length - 1 ? 'edit' : 'diff');
  }, [documents.length]);

  const getContentForVersion = useCallback((index: number): string => {
    if (!documents || index < 0 || index >= documents.length) return '';
    return documents[index].content ?? '';
  }, [documents]);

  const handleCreateDocumentWithId = useCallback(async (id: string) => {
    if (isCreatingDocument) return;
    try {
      await createDocument({
        title: 'Untitled Document',
        content: '',
        chatId: null,
        navigateAfterCreate: true,
        providedId: id
      });
    } catch (error) {
      console.error('Error creating document with specific ID:', error);
      toast.error('Failed to create document');
    }
  }, [isCreatingDocument, createDocument]);

  const handleCreateDocumentFromEditor = useCallback(async (initialContent: string) => {
      if (isCreatingDocument || initialDocumentId !== 'init') return;
      const newDocId = generateUUID();
      try {
          await createDocument({
              title: 'Untitled Document',
              content: initialContent,
              chatId: null,
              navigateAfterCreate: true,
              providedId: newDocId
          });
      } catch (error) {
          console.error('Error creating document from editor:', error);
          toast.error('Failed to create document');
      }
  }, [isCreatingDocument, initialDocumentId, createDocument]);

  const isCurrentVersion = useMemo(() => {
    // When documents haven't loaded yet, default to true for new/forked documents
    if (documents.length === 0) {
      return true;
    }
    return currentVersionIndex === documents.length - 1;
  }, [currentVersionIndex, documents]);

  const editorContent = useMemo(() => {
      if (initialDocumentId === 'init' && !showCreateDocumentForId) {
          return '';
      }
      if (documents.length === 0 && !showCreateDocumentForId) {
          return '';
      }
      return getContentForVersion(currentVersionIndex);

  }, [initialDocumentId, documents, currentVersionIndex, showCreateDocumentForId, getContentForVersion]);

  const editorDocumentId = useMemo(() => {
       if (showCreateDocumentForId) return 'init';
       return latestDocument?.id ?? 'init';
   }, [showCreateDocumentForId, latestDocument]);

  if (showCreateDocumentForId) {
    return (
      <div className="flex flex-col h-dvh bg-background">
        <div className="flex justify-between items-center border-b px-3 h-[45px]">
          <SidebarTrigger />
        </div>

        <div className="flex flex-col items-center justify-center h-full gap-8 px-4 text-muted-foreground"> 
          <Card className="w-44 h-32 sm:w-52 sm:h-36 md:w-56 md:h-40 border border-border shadow-sm overflow-hidden bg-background">
            <div className="h-5 bg-muted flex items-center px-2 text-[9px] text-muted-foreground/80 font-mono gap-1">
              <Skeleton className="h-2.5 w-3/5" />
            </div>
            <div className="p-3 space-y-1">
              <Skeleton className="h-2.5 w-2/3" />
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-5/6" />
            </div>
          </Card>

          <div className="text-center">
            <h3 className="text-lg font-medium mb-1 text-foreground ">Document Not Found</h3>
            <p className="text-sm">Create a new document?</p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-md">
            <Button
              size="sm"
              variant="default"
              className="w-full"
              onClick={() => handleCreateDocumentWithId(showCreateDocumentForId)}
              disabled={isCreatingDocument}
            >
              {isCreatingDocument ? <Loader2 className="size-4 animate-spin mx-auto" /> : 'Create Document'}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              size="sm"
              onClick={() => router.push('/documents')}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <div className="flex flex-row justify-between items-center border-b px-3 h-[45px]">
        <div className="flex flex-row gap-2 items-center min-w-0">
          <SidebarTrigger />
          {isPending ? (
            <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
          ) : (
            <div className="flex flex-col min-w-0">
              <div className="h-6 flex items-center">
                {editingTitle ? (
                  <Input
                    ref={titleInputRef}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="h-6 py-0 px-1 text-sm font-medium flex-grow bg-transparent border-transparent focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-75"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') handleCancelEditTitle();
                    }}
                    onBlur={handleSaveTitle}
                    disabled={isRenamingDocument || !latestDocument}
                    aria-label="Edit document title"
                  />
                ) : (
                  <div
                    className={`font-medium truncate h-6 leading-6 px-1 ${latestDocument ? 'cursor-pointer hover:underline' : 'text-muted-foreground'}`}
                    onClick={latestDocument ? handleEditTitle : undefined}
                    onDoubleClick={latestDocument ? handleEditTitle : undefined}
                    title={latestDocument ? `Rename "${latestDocument.title}"` : (initialDocumentId === 'init' ? 'Untitled Document' : 'Loading...')}
                  >
                    {latestDocument?.title ?? 'Document'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {documents && documents.length > 0 && (
            <DocumentActions
              content={editorContent}
              saveStatus={saveState}
            />
          )}
          {latestDocument && (
            <PublishSettingsMenu
              document={latestDocument}
              user={user}
              onUpdate={handleDocumentUpdate}
            />
          )}
          <AiSettingsMenu />
          <SidebarTrigger side="right" />
        </div>
      </div>
      
      <div className="bg-background text-foreground dark:bg-black dark:text-white h-full overflow-y-auto !max-w-full items-center relative">
        <VersionRail
          versions={documents}
          currentIndex={currentVersionIndex}
          onIndexChange={handleVersionChangeByIndex}
          baseDocumentId={editorDocumentId}
          isLoading={versionsLoading}
        />

        <div className="px-8 py-6 mx-auto max-w-3xl">
             {isPending ? (
                 <EditorSkeleton />
             ) : (
                 <Suspense fallback={<EditorSkeleton />}>
                     <Editor
                        key={`${editorDocumentId}-${currentVersionIndex}`}
                        content={editorContent}
                        status={'idle'}
                        isCurrentVersion={isCurrentVersion}
                        currentVersionIndex={currentVersionIndex}
                        documentId={editorDocumentId}
                        initialLastSaved={latestDocument ? new Date(latestDocument.updatedAt) : null}
                        onStatusChange={(newSaveState: SaveState) => {
                           setSaveState(newSaveState.status);
                        }}
                        onCreateDocumentRequest={handleCreateDocumentFromEditor}
                      />
                </Suspense>
             )}
        </div>
      </div>
    </div>
  );
} 