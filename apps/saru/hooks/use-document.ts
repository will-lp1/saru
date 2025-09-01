"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateUUID } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

export interface CurrentDocument {
  documentId: string;
  title: string;
  content: string;
  status: "idle" | "loading" | "streaming";
}

export const initialDocument: CurrentDocument = {
  documentId: "init",
  title: "",
  content: "",
  status: "idle",
};

interface CreateDocumentParams {
  title: string;
  content: string;
  chatId: string | null;
  navigateAfterCreate?: boolean;
  providedId?: string;
}

interface LoadDocumentParams {
  navigateAfterLoad?: boolean;
  chatId?: string;
}

interface DeleteDocumentParams {
  redirectUrl?: string;
}

export function useDocument() {
  const { data, mutate } = useSWR<CurrentDocument>("current-document", null, {
    fallbackData: initialDocument,
  });

  const document = data ?? initialDocument;
  const router = useRouter();
  const { setOpenMobile, openMobile } = useSidebar();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [isRenamingDocument, setIsRenamingDocument] = useState(false);

  const setDocument = useCallback(
    (update: CurrentDocument | ((prev: CurrentDocument) => CurrentDocument)) => {
      mutate(prev => (typeof update === "function" ? (update as any)(prev ?? initialDocument) : update), false);
    },
    [mutate]
  );

  const handleResetChat = useCallback(() => {
    console.log('[useDocument] Resetting chat state');
    window.dispatchEvent(new CustomEvent('reset-chat-state'));
    
    if (openMobile) {
      setOpenMobile(false);
    }
  }, [openMobile, setOpenMobile]);

  const handleNewChat = useCallback(() => {
    if (isCreatingChat) return;
    setIsCreatingChat(true);
    
    try {
      setDocument({
        documentId: 'init', 
        title: 'New Document',
        status: 'idle',
        content: '',
      });
      
      setOpenMobile(false);
      
      router.push('/documents');
      router.refresh();
    } catch (error) {
      console.error('Error creating new document:', error);
      toast.error('Failed to create new document');
    } finally {
      setIsCreatingChat(false);
    }
  }, [isCreatingChat, setDocument, setOpenMobile, router]);

  const createNewDocument = useCallback(async () => {
    if (isCreatingDocument) return;
    
    setIsCreatingDocument(true);
    const newDocId = generateUUID();
    
    try {
      console.log('[Document] Creating new document:', {
        documentId: newDocId
      });
      
      const docResponse = await fetch('/api/document', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: newDocId,
          title: 'Document',
          content: '',
          kind: 'text',
        }),
      });
      
      if (!docResponse.ok) {
        const docErrorData = await docResponse.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Document] Failed to create document:', docResponse.status, docErrorData);
        throw new Error(`Failed to create document: ${docResponse.status} ${docErrorData.error || ''}`);
      }
      
      const document = await docResponse.json();
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-created', {
          detail: {
            document: document
          }
        }));
      }
      
      if (openMobile) {
        setOpenMobile(false);
      }
      
      toast.success('Document created', { 
        id: 'document-created',
        duration: 2000 
      });
      
      router.push(`/documents/${newDocId}`);
      
    } catch (error) {
      console.error('[Document] Error creating document:', error);
      
      toast.error('Failed to create document', {
        description: error instanceof Error ? error.message : String(error),
        duration: 5000
      });
    } finally {
      setTimeout(() => {
        setIsCreatingDocument(false);
      }, 1000);
    }
  }, [isCreatingDocument, openMobile, setOpenMobile, router]);

  const renameDocument = useCallback(async (newTitle: string) => {
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
  }, [isRenamingDocument, document.documentId, setDocument]);

  const createDocument = useCallback(async (params: CreateDocumentParams) => {
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
      
      const doc = await response.json();
      
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
            document: doc
          }
        }));
      }
      
      if (params.navigateAfterCreate) {
        router.push(`/documents/${documentId}`);
      }
      
      return doc;
    } catch (error) {
      console.error('[useDocument] Error creating document:', error);
      toast.error('Failed to create document');
      return null;
    } finally {
      setIsCreatingDocument(false);
    }
  }, [setDocument, router]);
  
  const loadDocument = useCallback(async (documentId: string, params?: LoadDocumentParams) => {
    try {
      if (!documentId || documentId === 'init') {
        console.error('[useDocument] Invalid document ID:', documentId);
        return null;
      }
      
      const response = await fetch(`/api/document?id=${documentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.statusText}`);
      }
      
      const documents = await response.json();
      
      if (!documents || documents.length === 0) {
        console.error('[useDocument] Document not found:', documentId);
        return null;
      }
      
      const doc = documents[0];
      
      setDocument(curr => ({
        ...curr,
        documentId: doc.id,
        title: doc.title,
        content: doc.content || '',
        status: 'idle',
      }));
      
      if (params?.navigateAfterLoad) {
        router.push(`/documents/${documentId}`);
      }
      
      return doc;
    } catch (error) {
      console.error('[useDocument] Error loading document:', error);
      toast.error('Failed to load document');
      return null;
    }
  }, [setDocument, router]);
  
  const deleteDocument = useCallback(async (documentId: string, params?: DeleteDocumentParams) => {
    try {
      if (!documentId || documentId === 'undefined' || documentId === 'null' || documentId === 'init') {
        console.error('[useDocument] Invalid document ID for deletion:', documentId);
        toast.error('Cannot delete: Invalid document ID');
        return false;
      }

      const response = await fetch(`/api/document`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: documentId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
      
      if (params?.redirectUrl) {
        router.replace(params.redirectUrl);
      } else {
        router.refresh();
      }
      
      toast.success('Document deleted');
      return true;
    } catch (error) {
      console.error('[useDocument] Error deleting document:', error);
      toast.error('Failed to delete document');
      return false;
    }
  }, [router]);

  return useMemo(() => ({
    document, 
    setDocument,
    handleNewChat,
    createNewDocument,
    renameDocument,
    isCreatingChat,
    isCreatingDocument,
    isRenamingDocument,
    createDocument,
    loadDocument,
    deleteDocument,
    handleResetChat,
  }), [document, setDocument, handleNewChat, createNewDocument, renameDocument, isCreatingChat, isCreatingDocument, isRenamingDocument, createDocument, loadDocument, deleteDocument, handleResetChat]);
}