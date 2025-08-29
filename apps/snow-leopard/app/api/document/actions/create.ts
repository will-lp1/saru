import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth"; // Import Better Auth
import { headers } from 'next/headers'; // Import headers
import { 
  saveDocument, 
  getDocumentById 
} from '@/lib/db/queries';
import { generateUUID } from '@/lib/utils';
/**
 * Handles document creation (POST)
 * Creates a new version of a document. If an ID is provided and exists for the user,
 * older versions will be marked as not current.
 */
export async function createDocument(request: NextRequest, body: any) {
  try {
    // --- Authentication --- 
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });
    
    if (!session?.user?.id) {
      console.warn('[Document API - CREATE] Create request unauthorized - no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    
    // --- Input Validation --- 
    const { 
      id: providedId, 
      title = 'Untitled Document', // Default title
      content = '', // Default content
      kind = 'text', // Default kind
      chatId // Optional chatId
    } = body;
    
    // Generate a UUID if none provided, otherwise use the provided one
    const documentId = providedId || generateUUID();
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      console.error(`[Document API - CREATE] Invalid document ID format: ${documentId}`);
      return NextResponse.json({ 
        error: `Invalid document ID format. Must be a valid UUID.` 
      }, { status: 400 });
    }

    console.log(`[Document API - CREATE] User ${userId} creating document: ${documentId}`);

    await saveDocument({
      id: documentId,
      title: title,
      content: content,
      kind: kind,
      userId: userId,
    });

    const newDocumentVersion = await getDocumentById({ id: documentId }); 
    
    if (!newDocumentVersion) {
       console.error(`[Document API - CREATE] Failed to retrieve document ${documentId} immediately after saving.`);
       return NextResponse.json({ error: 'Failed to retrieve created document data.'}, { status: 500 });
    }

    console.log(`[Document API - CREATE] Document version created successfully: ${documentId}`);
    return NextResponse.json(newDocumentVersion);

  } catch (error: any) {
    console.error('[Document API - CREATE] Create error:', error);
    return NextResponse.json({ 
      error: `Failed to create document: ${error.message || String(error)}`
    }, { status: 500 });
  }
} 