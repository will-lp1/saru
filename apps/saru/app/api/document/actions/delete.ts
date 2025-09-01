import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth"; // Import Better Auth
import { headers } from 'next/headers'; // Import headers
import { deleteDocumentByIdAndUserId } from '@/lib/db/queries'; // Import Drizzle query

/**
 * Handles document deletion operations (DELETE)
 */
export async function deleteDocument(request: NextRequest, body: any) {
  try {
    // --- Authentication --- 
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });
    
    if (!session?.user?.id) {
      console.warn('[Document API - DELETE] Delete request unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    
    const { id: documentId } = body; // Rename id to documentId for clarity
    
    console.log(`[Document API - DELETE] User ${userId} requested deletion for document: ${documentId}`);
    
    // --- Validation --- 
    if (!documentId || documentId === 'undefined' || documentId === 'null' || documentId === 'init') {
      console.error(`[Document API - DELETE] Invalid document ID for deletion: ${documentId}`);
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 });
    }

    // Validate UUID format (optional but good practice)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      console.error(`[Document API - DELETE] Invalid document ID format: ${documentId}`);
      return NextResponse.json({ 
        error: `Invalid document ID format. Must be a valid UUID.` 
      }, { status: 400 });
    }
    
    // --- Deletion --- 
    // The Drizzle query function `deleteDocumentByIdAndUserId` handles both 
    // checking ownership and deleting all versions if authorized.
    await deleteDocumentByIdAndUserId({ userId: userId, documentId: documentId });
    
    console.log(`[Document API - DELETE] Document deleted successfully: ${documentId}`);
    return NextResponse.json({ success: true, message: 'Document deleted successfully' });

  } catch (error: any) {
    // Handle potential errors from the query function (e.g., Unauthorized)
    console.error('[Document API - DELETE] Delete error:', error);
    
    let status = 500;
    let message = 'Failed to delete document';

    if (error.message?.includes('Unauthorized')) {
      status = 403; // Forbidden
      message = 'Unauthorized - you do not own this document or it does not exist';
    } else if (error.message?.includes('not found')) {
       status = 404; // Not Found
       message = 'Document not found';
    }

    return NextResponse.json({ 
      error: message, 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: status });
  }
} 