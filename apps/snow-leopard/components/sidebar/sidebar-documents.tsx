'use client';

import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@/lib/auth';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { cn, fetcher } from '@/lib/utils';
import {
  FileIcon,
  MoreHorizontalIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Document } from '@snow-leopard/db';
import { useDocument } from '@/hooks/use-document';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useSWRInfinite from 'swr/infinite';
import { motion } from 'framer-motion';

type GroupedDocuments = {
  today: Document[];
  yesterday: Document[];
  lastWeek: Document[];
  lastMonth: Document[];
  older: Document[];
};

const DOCUMENT_PAGE_SIZE = 25;

interface PaginatedDocuments {
  documents: Document[];
  hasMore: boolean;
}

const PureDocumentItem = ({
  document,
  isActive,
  onDelete,
  setOpenMobile,
  onSelect,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: {
  document: Document;
  isActive: boolean;
  onDelete: (documentId: string) => void;
  setOpenMobile: (open: boolean) => void;
  onSelect: (documentId: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (documentId: string, isSelected: boolean) => void;
}) => {
  const handleDocumentClick = useCallback((e: React.MouseEvent) => {
    if (isActive && !isSelectionMode) {
      e.preventDefault();
      return;
    }
    
    if (isSelectionMode) {
      onToggleSelect(document.id, !isSelected);
      return;
    }
    
    if (typeof window !== 'undefined') {
      (window as any).__LAST_SELECTED_DOCUMENT = document.id;
      if ((window as any).__DOCUMENT_CACHE) {
        (window as any).__DOCUMENT_CACHE.set(document.id, document);
      }
    }
    
    setOpenMobile(false);
    onSelect(document.id);
  }, [document, isActive, isSelectionMode, isSelected, onToggleSelect, setOpenMobile, onSelect]);

  const router = useRouter();

  return (
    <SidebarMenuItem>
      <div className="flex items-center w-full">
        {isSelectionMode && (
          <div className="flex items-center pl-2 pr-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggleSelect(document.id, !!checked)}
              aria-label={`Select ${document.title}`}
            />
          </div>
        )}
        <SidebarMenuButton 
          asChild 
          isActive={isActive}
          className={cn(isSelectionMode && "flex-1")}
        >
          <Link 
            href={isSelectionMode ? "#" : `/documents/${document.id}`}
            onClick={handleDocumentClick}
          >
            <span className="truncate">{document.title}</span>
          </Link>
        </SidebarMenuButton>
      </div>

      {!isSelectionMode && (
        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
              showOnHover={!isActive}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
              onSelect={() => onDelete(document.id)}
            >
              <TrashIcon />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuItem>
  );
};

export const DocumentItem = memo(PureDocumentItem, (prevProps, nextProps) => {
  if (prevProps.document.title !== nextProps.document.title) return false;
  if (prevProps.isActive !== nextProps.isActive) return false;
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.document.id !== nextProps.document.id) return false;
  return true;
});

export function SidebarDocuments({ user, initialDocuments }: { user?: User; initialDocuments?: any[] }) {
  const { setOpenMobile } = useSidebar();
  const router = useRouter();
  const { setDocument } = useDocument();
  const { 
    createNewDocument, 
    deleteDocument,
    isCreatingDocument
  } = useDocument();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  
  const {
    data: paginatedDocumentsData,
    isLoading,
    mutate
  } = useSWRInfinite<PaginatedDocuments>(
    (pageIndex, previousPageData) => {
      if (!user) return null;
      if (previousPageData && !previousPageData.hasMore) return null;
      if (pageIndex === 0) return `/api/document?limit=${DOCUMENT_PAGE_SIZE}`;
      if (!previousPageData?.documents?.length) return null;
      const lastDoc = previousPageData.documents.at(-1);
      if (!lastDoc) return null;
      return `/api/document?limit=${DOCUMENT_PAGE_SIZE}&ending_before=${lastDoc.id}`;
    },
    fetcher,
    {
      fallbackData: initialDocuments ? [{ documents: initialDocuments, hasMore: false }] : [],
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const documents = paginatedDocumentsData ? paginatedDocumentsData.flatMap(page => page.documents) : [];
  const lastPage = paginatedDocumentsData?.[paginatedDocumentsData.length - 1];
  const hasReachedEnd = lastPage ? !lastPage.hasMore : false;
  const hasEmptyDocuments = paginatedDocumentsData?.every(page => page.documents.length === 0) ?? false;

  const pathname = usePathname();
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/\/documents\/([^/?]+)/);
    const newActiveId = match ? match[1] : null;
    setActiveDocumentId(newActiveId);
  }, [pathname]);

  useEffect(() => {
    const handleDocumentCreated = (event: CustomEvent) => {
      console.log('[SidebarDocuments] Document created event received', event.detail);

      if (event.detail?.document) {
        mutate();
      }
    };

    const handleDocumentRenamed = (event: CustomEvent) => {
      console.log('[SidebarDocuments] Document renamed event received', event.detail);

      if (event.detail?.documentId && event.detail?.newTitle) {
        mutate((pages) => {
          if (!pages) return pages;
          return pages.map(page => ({
            ...page,
            documents: page.documents.map(doc => {
              if (doc.id === event.detail.documentId) {
                return { ...doc, title: event.detail.newTitle };
              }
              return doc;
            })
          }));
        }, false);
      }
    };

    window.addEventListener('document-created', handleDocumentCreated as EventListener);
    window.addEventListener('document-renamed', handleDocumentRenamed as EventListener);

    return () => {
      window.removeEventListener('document-created', handleDocumentCreated as EventListener);
      window.removeEventListener('document-renamed', handleDocumentRenamed as EventListener);
    };
  }, [mutate]);

  useEffect(() => {
    if (activeDocumentId) {
      console.log('[SidebarDocuments] Active document changed, refreshing list');
      mutate();
    }
    
    const handleDocumentUpdate = () => {
      console.log('[SidebarDocuments] Document updated, refreshing list');
      mutate();
    };
    
    window.addEventListener('document-updated', handleDocumentUpdate);
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate);
    };
  }, [activeDocumentId, mutate]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showMultiDeleteDialog, setShowMultiDeleteDialog] = useState(false);
  
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedDocuments(new Set());
  };
  
  const handleToggleSelect = (documentId: string, isSelected: boolean) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(documentId);
      } else {
        newSet.delete(documentId);
      }
      return newSet;
    });
  };
  
  const handleSelectAll = () => {
    if (documents) {
      const filteredDocuments = filterDocuments(documents);
      if (selectedDocuments.size === filteredDocuments.length) {
        setSelectedDocuments(new Set());
      } else {
        setSelectedDocuments(new Set(filteredDocuments.map(doc => doc.id)));
      }
    }
  };
  
  const handleDelete = async () => {
    if (!deleteId) return;
    
    setShowDeleteDialog(false);
    
    const url = new URL(window.location.href);
    const documentFromUrl = url.searchParams.get('document');
    const isCurrentDocument = documentFromUrl === deleteId;
    
    const redirectUrl = isCurrentDocument ? `/documents/${deleteId}` : '';
    
    const success = await deleteDocument(deleteId, {
      redirectUrl: redirectUrl
    });
    
    if (success) {
      mutate((pages) => {
        if (!pages) return pages;
        return pages.map(page => ({
          ...page,
          documents: page.documents.filter((d) => d.id !== deleteId)
        }));
      }, false);
    }
  };
  
  const handleDeleteMultiple = async () => {
    const selectedDocumentIds = Array.from(selectedDocuments);
    
    setShowMultiDeleteDialog(false);
    
    const url = new URL(window.location.href);
    const documentFromUrl = url.searchParams.get('document');
    const isCurrentDocumentSelected = documentFromUrl && selectedDocuments.has(documentFromUrl);
    
    try {
      mutate((pages) => {
        if (!pages) return pages;
        return pages.map(page => ({
          ...page,
          documents: page.documents.filter(d => !selectedDocuments.has(d.id))
        }));
      }, false);
      
      if (isCurrentDocumentSelected) {
        router.replace(`/documents/${documentFromUrl}`);
      }
      
      const deletePromises = selectedDocumentIds.map(documentId => 
        deleteDocument(documentId, { redirectUrl: '' })
      );
      
      await Promise.all(deletePromises);
      
      setSelectedDocuments(new Set());
      setIsSelectionMode(false);
      
      toast.success(`${selectedDocumentIds.length} documents deleted`);
    } catch (error) {
      console.error('[SidebarDocuments] Error deleting multiple documents:', error);
      toast.error('Failed to delete some documents');
      
      mutate();
    }
  };
  
  const handleDocumentSelect = useCallback(async (documentId: string) => {
    setActiveDocumentId(documentId); 
    
    try {
      if (documentId === 'init' || !documentId) {
        console.error('[SidebarDocuments] Invalid document ID:', documentId);
        return;
      }
      
      const selectedDocData = documents?.find(doc => doc.id === documentId);
      
      setDocument((curr: any) => {
        const newTitle = selectedDocData?.title || 'Loading...';        
        console.log(`[SidebarDocuments] Optimistically setting artifact: ID=${documentId}, Title=${newTitle}`);
        return {
          ...curr, 
          documentId: documentId,
          title: newTitle,
          content: '',
          status: 'idle',
        };
      });
      
      console.log('[SidebarDocuments] Navigating to:', `/documents/${documentId}`);
      router.push(`/documents/${documentId}`);

      setOpenMobile(false);

    } catch (error) {
      console.error('[SidebarDocuments] Error selecting document:', error);
      toast.error('Failed to load document');
      setDocument((curr: any) => ({ ...curr, status: 'idle' }));
    }
  }, [documents, setDocument, router, setOpenMobile, activeDocumentId]);

  const filterDocuments = (docs: Document[]) => {
    if (!searchTerm.trim()) return docs;
    
    return docs.filter(doc => 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.content && doc.content.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const groupDocumentsByDate = (docs: Document[]): GroupedDocuments => {
    const now = new Date();
    const oneWeekAgo = subWeeks(now, 1);
    const oneMonthAgo = subMonths(now, 1);

    return docs.reduce(
      (groups, doc) => {
        const docDate = new Date(doc.createdAt);

        if (isToday(docDate)) {
          groups.today.push(doc);
        } else if (isYesterday(docDate)) {
          groups.yesterday.push(doc);
        } else if (docDate > oneWeekAgo) {
          groups.lastWeek.push(doc);
        } else if (docDate > oneMonthAgo) {
          groups.lastMonth.push(doc);
        } else {
          groups.older.push(doc);
        }

        return groups;
      },
      {
        today: [],
        yesterday: [],
        lastWeek: [],
        lastMonth: [],
        older: [],
      } as GroupedDocuments,
    );
  };

  if (isLoading && documents.length === 0) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
          Loading...
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                key={item}
                className="rounded-md h-8 flex gap-2 px-2 items-center"
              >
                <div
                  className="h-4 rounded-md flex-1 max-w-[--skeleton-width] bg-sidebar-accent-foreground/10"
                  style={
                    {
                      '--skeleton-width': `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const filteredDocuments = documents ? filterDocuments(documents) : [];
  if (hasEmptyDocuments && !searchTerm) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-xs text-sidebar-foreground/50 flex items-center justify-between cursor-pointer">
          <span>Documents</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="size-5" 
            onClick={createNewDocument}
            disabled={isCreatingDocument}
          >
            {isCreatingDocument ? (
              <svg className="animate-spin size-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <PlusIcon size={12} />
            )}
          </Button>
        </div>
        <SidebarGroupContent>
          <div className="px-2 text-zinc-500 w-full flex flex-row justify-center items-center text-sm gap-2 py-4">
            No documents yet
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <div 
          className="px-2 py-1 text-xs text-sidebar-foreground/50 flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Documents {documents && documents.length > 0 && `(${documents.length})`}</span>
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="size-5" 
              onClick={(e) => {
                e.stopPropagation();
                createNewDocument();
              }}
              disabled={isCreatingDocument}
            >
              {isCreatingDocument ? (
                <svg className="animate-spin size-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <PlusIcon size={12} />
              )}
            </Button>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        {isExpanded && (
          <>
            <div className="px-2 mt-1 mb-2">
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 text-xs border border-r bg-sidebar-accent"
              />
              
            </div>
            
            {filteredDocuments.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 px-2 mt-1 mb-2">
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={handleToggleSelectionMode}
                    className={cn(
                      "h-7 text-xs w-full",
                      !isSelectionMode && "col-span-2"
                    )}
                  >
                    {isSelectionMode ? "Cancel" : "Select"}
                  </Button>

                  {isSelectionMode && (
                    <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        selectedDocuments.size > 0 && setShowMultiDeleteDialog(true)
                      }
                      disabled={selectedDocuments.size === 0}
                      className="h-7 text-xs w-full"
                    >
                      Delete ({selectedDocuments.size})
                    </Button>
                    </>
                  )}
                </div>
              </>
            )}

            <SidebarGroupContent>
              <SidebarMenu>
                {searchTerm.trim() ? (
                  filteredDocuments.length === 0 ? (
                    <div className="px-2 text-zinc-500 text-sm text-center py-4">
                      No documents found matching &quot;{searchTerm}&quot;
                    </div>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <DocumentItem
                        key={`${doc.id}-${doc.createdAt}`}
                        document={doc}
                        isActive={doc.id === activeDocumentId}
                        onDelete={(documentId) => {
                          setDeleteId(documentId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                        onSelect={handleDocumentSelect}
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedDocuments.has(doc.id)}
                        onToggleSelect={handleToggleSelect}
                      />
                    ))
                  )
                ) : (
                  (() => {
                    const groupedDocuments = groupDocumentsByDate(filteredDocuments);
                    return (
                      <>
                        {groupedDocuments.today.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
                              Today
                            </div>
                            {groupedDocuments.today.map((doc) => (
                              <DocumentItem
                                key={`${doc.id}-${doc.createdAt}`}
                                document={doc}
                                isActive={doc.id === activeDocumentId}
                                onDelete={(documentId) => {
                                  setDeleteId(documentId);
                                  setShowDeleteDialog(true);
                                }}
                                setOpenMobile={setOpenMobile}
                                onSelect={handleDocumentSelect}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.has(doc.id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}
                          </>
                        )}

                        {groupedDocuments.yesterday.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-4">
                              Yesterday
                            </div>
                            {groupedDocuments.yesterday.map((doc) => (
                              <DocumentItem
                                key={`${doc.id}-${doc.createdAt}`}
                                document={doc}
                                isActive={doc.id === activeDocumentId}
                                onDelete={(documentId) => {
                                  setDeleteId(documentId);
                                  setShowDeleteDialog(true);
                                }}
                                setOpenMobile={setOpenMobile}
                                onSelect={handleDocumentSelect}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.has(doc.id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}
                          </>
                        )}

                        {groupedDocuments.lastWeek.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-4">
                              Last 7 days
                            </div>
                            {groupedDocuments.lastWeek.map((doc) => (
                              <DocumentItem
                                key={`${doc.id}-${doc.createdAt}`}
                                document={doc}
                                isActive={doc.id === activeDocumentId}
                                onDelete={(documentId) => {
                                  setDeleteId(documentId);
                                  setShowDeleteDialog(true);
                                }}
                                setOpenMobile={setOpenMobile}
                                onSelect={handleDocumentSelect}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.has(doc.id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}
                          </>
                        )}

                        {groupedDocuments.lastMonth.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-4">
                              Last 30 days
                            </div>
                            {groupedDocuments.lastMonth.map((doc) => (
                              <DocumentItem
                                key={`${doc.id}-${doc.createdAt}`}
                                document={doc}
                                isActive={doc.id === activeDocumentId}
                                onDelete={(documentId) => {
                                  setDeleteId(documentId);
                                  setShowDeleteDialog(true);
                                }}
                                setOpenMobile={setOpenMobile}
                                onSelect={handleDocumentSelect}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.has(doc.id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}
                          </>
                        )}

                        {groupedDocuments.older.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs text-sidebar-foreground/50 mt-4">
                              Older
                            </div>
                            {groupedDocuments.older.map((doc) => (
                              <DocumentItem
                                key={`${doc.id}-${doc.createdAt}`}
                                document={doc}
                                isActive={doc.id === activeDocumentId}
                                onDelete={(documentId) => {
                                  setDeleteId(documentId);
                                  setShowDeleteDialog(true);
                                }}
                                setOpenMobile={setOpenMobile}
                                onSelect={handleDocumentSelect}
                                isSelectionMode={isSelectionMode}
                                isSelected={selectedDocuments.has(doc.id)}
                                onToggleSelect={handleToggleSelect}
                              />
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </>
        )}
      </SidebarGroup>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              document and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={showMultiDeleteDialog} onOpenChange={setShowMultiDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedDocuments.size} documents?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected
              documents and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMultiple}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete {selectedDocuments.size} documents
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 