import { auth } from "@/lib/auth"; // Import Better Auth
import { headers } from 'next/headers'; // Import headers
import { 
  searchDocumentsByQuery, 
  getCurrentDocumentByTitle, 
  getDocumentById 
} from '@/lib/db/queries'; // Import Drizzle queries

/**
 * Gets a file by path - attempts to match ID first, then title.
 * This is a simplified utility that could be extended in the future
 * 
 * @param path The file ID or title to search for
 * @returns The document metadata or null
 */
export async function getFileByPath(path: string) {
  try {
    // --- Authentication --- 
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });
    
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }
    const userId = session.user.id;
    
    // --- Database Lookup --- 
    // Attempt to find by ID first (more specific)
    let document = await getDocumentById({ id: path });

    // If found by ID, check ownership
    if (document && document.userId !== userId) {
      console.warn(`[getFileByPath] User ${userId} attempted to access document ${path} owned by ${document.userId}`);
      return null; // Unauthorized access attempt
    }

    // If not found by ID (or if user didn't own it), try searching by title (case-insensitive)
    if (!document) {
      document = await getCurrentDocumentByTitle({ userId: userId, title: path });
    }

    // If still not found, return null
    if (!document) {
      return null;
    }
    
    // Return selected fields (or the whole document object)
    return {
      id: document.id,
      title: document.title,
      content: document.content,
      createdAt: document.createdAt
      // Add other fields as needed
    };

  } catch (error) {
    // Log specific error if needed, but generally return null for path errors
    console.error(`Error getting file by path "${path}":`, error);
    return null;
  }
}

/**
 * Search current documents by query string
 * Returns documents matching the search criteria, formatted for mention UI
 * 
 * @param query The search query
 * @param limit Maximum number of results to return
 * @returns Object containing results array and original query
 */
export async function searchDocuments({ 
  query, 
  limit = 5 
}: { 
  query: string; 
  limit?: number;
}) {
  try {
    // --- Authentication --- 
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });
    
    if (!session?.user?.id) {
      console.warn('[Document Search] Unauthorized search request');
      throw new Error('Unauthorized');
    }
    const userId = session.user.id;
    
    console.log(`[Document Search] User ${userId} searching for: "${query}"`);
    
    // --- Database Search --- 
    // Use the new Drizzle query function
    const documents = await searchDocumentsByQuery({ 
      userId: userId, 
      query: query, 
      limit: limit 
    });
        
    // Format results for the mention UI (same logic)
    const results = documents?.map(doc => ({
      id: doc.id,
      title: doc.title || 'Untitled Document',
      type: 'document' // Assuming a type identifier is needed
    })) || [];
    
    return {
      results,
      query
    };

  } catch (error) {
    console.error('[Document Search] Error executing search:', error);
    return {
      results: [],
      error: 'Failed to search documents'
      // Optionally include the original query in the error response
      // query 
    };
  }
} 