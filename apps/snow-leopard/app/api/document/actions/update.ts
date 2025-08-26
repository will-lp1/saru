import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers'; 
import { differenceInMinutes } from 'date-fns';
import {
  getCurrentDocumentVersion,
  updateCurrentDocumentVersion,
  createNewDocumentVersion,
  getChatExists,
  getLatestDocumentById, // To return the final state
  createDebouncedDocumentVersion
} from '@/lib/db/queries';
import { Document } from '@snow-leopard/db';

const VERSION_THRESHOLD_MINUTES = 10; 
const DEBOUNCE_VERSION_SECONDS = 5; 

/**
 * Handles document update operations (POST)
 * Updates the latest version if within threshold and metadata matches,
 * otherwise creates a new version.
 */
export async function updateDocument(request: NextRequest, body: any): Promise<NextResponse> {
  try {
    // --- Authentication --- 
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });
    
    if (!session?.user?.id) {
      console.warn('[Document API - UPDATE] Update request unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    
    // --- Input Validation --- 
    const { 
      id: documentId,
      content: inputContent = '',
      kind: inputKind = 'text',
      chatId: inputChatId
    } = body;
    
    const content = inputContent;
    
    console.log(`[Document API - UPDATE] User ${userId} updating document: ${documentId}`);
    console.log('[Document API - UPDATE] Received:', { 
      id: documentId, 
      contentLength: content?.length || 0,
      chatId: inputChatId || 'none'
    });
    
    // Validate ID format (essential before querying)
    if (!documentId || documentId === 'undefined' || documentId === 'null' || documentId === 'init') {
      console.error(`[Document API - UPDATE] Invalid document ID: ${documentId}`);
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      console.error(`[Document API - UPDATE] Invalid document ID format: ${documentId}`);
      return NextResponse.json({ 
        error: `Invalid document ID format. Must be a valid UUID.` 
      }, { status: 400 });
    }

    // --- Versioning Logic --- 
    let updatedOrCreatedDocument: typeof Document.$inferSelect | null = null;

    try {
      // Always update the current document first (this is the main content)
      console.log(`[Document API - UPDATE] Always updating current document for ${documentId}`);
      updatedOrCreatedDocument = await updateCurrentDocumentVersion({
        userId,
        documentId,
        content,
      });
      
      if (!updatedOrCreatedDocument) {
        throw new Error('updateCurrentDocumentVersion returned null unexpectedly.');
      }
      
      const isDebouncedVersion = body.isDebouncedVersion === true;
      
      if (isDebouncedVersion) {
        console.log(`[Document API - UPDATE] Creating debounced version for ${documentId}`);
        const newVersion = await createDebouncedDocumentVersion({
          documentId,
          content,
          userId
        });
        
        if (newVersion) {
          console.log(`[Document API - UPDATE] Successfully created debounced version ${newVersion.version} for ${documentId}`);
        }
      }

      const finalDocumentState = updatedOrCreatedDocument;
      
      if (!finalDocumentState) {
          console.error(`[Document API - UPDATE] Failed to retrieve document ${documentId} after operation.`);
          const fallbackState = await getLatestDocumentById({ id: documentId });
           if (fallbackState) {
               console.warn('[Document API - UPDATE] Returning fallback state after initial retrieval failed.')
               return NextResponse.json(fallbackState);
           } else {
                return NextResponse.json({ error: 'Failed to retrieve updated document data after operation and fallback.'}, { status: 500 });
           }
      }

      console.log(`[Document API - UPDATE] Document ${documentId} processed successfully.`);
      return NextResponse.json(finalDocumentState); 

    } catch (dbError: any) {
      console.error(`[Document API - UPDATE] Database operation error for doc ${documentId}:`, dbError);
      if (dbError.message === 'Document not found or unauthorized.') {
          return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
      }
      return NextResponse.json({ 
        error: `Database operation failed: ${dbError.message || String(dbError)}`
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Document API - UPDATE] General update error:', error);
    return NextResponse.json({ 
      error: `Failed to update document: ${error.message || String(error)}`
    }, { status: 500 });
  }
} 