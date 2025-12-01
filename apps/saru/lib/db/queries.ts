import 'server-only';
import { db } from '@saru/db'; 
import * as schema from '@saru/db'; 
import { eq, desc, asc, inArray, gt, gte, and, sql, lt } from 'drizzle-orm'; // Import Drizzle operators and

type Chat = typeof schema.Chat.$inferSelect; 
type Message = typeof schema.Message.$inferSelect; 
type Document = typeof schema.Document.$inferSelect; 


interface MessageContent {
  type: 'text' | 'tool_call' | 'tool_result';
  content: any;
  order: number;
}

interface SaveMessageContentParams {
  messageId: string;
  contents: MessageContent[];
}

export async function saveChat({
  id,
  userId,
  title,
  document_context,
}: {
  id: string;
  userId: string;
  title: string;
  document_context?: {
    active?: string;
    mentioned?: string[];
  } | null; // Drizzle expects null for JSONB
}) {
  try {
    await db.insert(schema.Chat).values({
      id,
      userId,
      title,
      createdAt: new Date().toISOString(), // Keep using ISO string if schema expects it
      document_context,
    });
  } catch (error) {
    console.error('Error saving chat:', error);
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(schema.Chat).where(eq(schema.Chat.id, id));
  } catch (error) {
    console.error('Error deleting chat:', error);
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }): Promise<Chat[]> {
  try {
    const data = await db.select()
      .from(schema.Chat)
      .where(eq(schema.Chat.userId, id))
      .orderBy(desc(schema.Chat.createdAt));
    return data;
  } catch (error) {
    console.error('Error fetching chats by user ID:', error);
    throw error; 
  }
}

export async function getChatById({ id }: { id: string }): Promise<Chat | null> {
  try {
    const data = await db.select()
      .from(schema.Chat)
      .where(eq(schema.Chat.id, id))
      .limit(1);

    return data[0] || null;
  } catch (error) {
    console.error('Error fetching chat:', error);
    return null;
  }
}

export async function saveMessages({ messages }: { messages: Array<typeof schema.Message.$inferInsert> }) {
   try {
    const formattedMessages = messages.map(msg => {
        let finalContent: string | null = null;
        if (typeof msg.content === 'string') {
          finalContent = JSON.stringify([{ type: 'text', content: msg.content, order: 0 }]);
        } else if (typeof msg.content === 'object' && msg.content !== null) {
          finalContent = JSON.stringify(msg.content);
        } else {
          console.warn(`[DB Query - saveMessages] Unexpected message content type for msg ID (if exists) ${msg.id}:`, typeof msg.content);
          finalContent = JSON.stringify([]);
        }

        return {
            ...msg,
            content: finalContent 
        };
    });

    if (formattedMessages.length > 0) {
      await db.insert(schema.Message).values(formattedMessages);
    } else {
      console.log('[DB Query - saveMessages] No messages to save, skipping db insert');
    }
  } catch (error) {
    console.error('Error saving messages:', error);
    throw error;
  }
}

/**
 * Parses message content from database format to application format
 * @param content - The raw content from the database (string or object)
 * @param messageId - The message ID for error logging
 * @param source - The source function name for error logging
 * @returns Parsed content as string or object
 */
function parseMessageContent(content: any, messageId: string, source: string): string | object {
  let parsedContent: string | object = '';
  try {
    if (content) {
      const contentArray = typeof content === 'string'
        ? JSON.parse(content)
        : content;

      if (Array.isArray(contentArray) && contentArray.length > 0) {
        const firstElement = contentArray[0];
        if (firstElement.type === 'text' && typeof firstElement.content === 'string') {
          parsedContent = firstElement.content;
        } else {
          parsedContent = contentArray;
        }
      } else if (typeof contentArray === 'object' && contentArray !== null) {
        parsedContent = contentArray;
      }
    }
  } catch (e) {
    console.error(`[DB Query - ${source}] Failed to parse message content for msg ${messageId}:`, e);
    parsedContent = '[Error parsing content]';
  }
  return parsedContent;
}

export async function getMessagesByChatId({ id }: { id: string }): Promise<Message[]> {
  try {
    const data = await db.select()
      .from(schema.Message)
      .where(eq(schema.Message.chatId, id))
      .orderBy(asc(schema.Message.createdAt));

    return data.map((message) => {
      return {
        ...message,
        content: parseMessageContent(message.content, message.id, 'getMessagesByChatId') as any,
      };
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
}

export async function getMessageById({ id }: { id: string }): Promise<Message | null> {
  try {
    const data = await db.select()
      .from(schema.Message)
      .where(eq(schema.Message.id, id))
      .limit(1);

    if (!data || data.length === 0) {
      return null;
    }

    return {
      ...data[0],
      content: parseMessageContent(data[0].content, data[0].id, 'getMessageById') as any,
    };
  } catch (error) {
    console.error('Error fetching message by ID:', error);
    return null;
  }
}

export async function updateToolMetadata({
  messageId,
  toolCallId,
  applied,
  rejected,
}: {
  messageId: string;
  toolCallId: string;
  applied: boolean;
  rejected: boolean;
}): Promise<void> {
  try {
    const message = await getMessageById({ id: messageId });
    if (!message) throw new Error('Message not found');

    const contentObj = message.content;
    
    if (!contentObj || typeof contentObj !== 'object') {
      throw new Error('Invalid message content structure');
    }

    const contentWithParts = contentObj as { parts?: Array<{ toolCallId?: string; output?: any; [key: string]: any }>; [key: string]: any };
    
    if (contentWithParts.parts && Array.isArray(contentWithParts.parts)) {
      contentWithParts.parts = contentWithParts.parts.map((part: any) => {
        if (part.toolCallId === toolCallId) {
          return {
            ...part,
            output: { ...part.output, applied, rejected },
          };
        }
        return part;
      });
    } else {
      console.warn(`[DB Query - updateToolMetadata] Message ${messageId} has no parts array`);
    }

    await db
      .update(schema.Message)
      .set({ content: JSON.stringify(contentObj) })
      .where(eq(schema.Message.id, messageId));
  } catch (error) {
    console.error('Error updating tool metadata:', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind = null,
  content,
  userId,
  chatId,
}: {
  id: string;
  title: string;
  kind?: string | null;
  content: string;
  userId: string;
  chatId?: string | null;
}): Promise<(typeof schema.Document.$inferSelect)> {
  try {
    const now = new Date();
    const newDocument = {
      id,
      title,
      content,
      userId,
      chatId: chatId || null,
      is_current: true,
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await db
      .insert(schema.Document)
      .values(newDocument)
      .returning();


    // appending latent version
    const newVersion = {
      documentId: newDocument.id,
      content: newDocument.content,
      previousVersionId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.DocumentVersion).values(newVersion);
    

    console.log(`[DB Query - saveDocument] Saved new version for doc ${id}, user ${userId}`);
    if (!inserted || inserted.length === 0) {
        throw new Error("Failed to insert new document version or retrieve the inserted data.");
    }
    return inserted[0];
  } catch (error) {
    console.error(`[DB Query - saveDocument] Error saving new version for doc ${id}, user ${userId}:`, error);
    throw new Error(`Failed to save document version: ${error instanceof Error ? error.message : String(error)}`);
  }
}


export async function updateDocumentVersion({
  documentId,
  content,
  previousContent
}: {
  documentId: string;
  content: string;
  previousContent?: string;
}): Promise<(typeof schema.DocumentVersion.$inferSelect)> {
  try {
    const data = await db.select().from(schema.DocumentVersion).where(eq(schema.DocumentVersion.documentId, documentId)).orderBy(desc(schema.DocumentVersion.createdAt)).limit(1);
    if (!data || data.length === 0) {
      throw new Error(`No document version found for document ${documentId}`);
    }
    const latestVersion = data[0].version;
    
    // Calculate diff content if previous content is provided
    const diffContent = previousContent ? calculateDiff(previousContent, content) : null;
    
    const newVersion = {
      documentId: documentId,
      content: content,
      diffContent: diffContent,
      previousVersionId: data[0].id,
      version: latestVersion + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.insert(schema.DocumentVersion).values(newVersion);
    return newVersion as (typeof schema.DocumentVersion.$inferSelect);
  } catch (error) {
    console.error(`[DB Query - updateDocumentVersion] Error updating document version for doc ${documentId}:`, error);
    throw new Error(`Failed to update document version: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to calculate diff between two content strings
function calculateDiff(oldContent: string, newContent: string): string {
  // Simple diff calculation - you can enhance this with more sophisticated diff algorithms
  if (oldContent === newContent) return '';
  
  // For now, return a simple diff representation
  // In a real implementation, you might want to use a proper diff library
  return JSON.stringify({
    type: 'content_change',
    oldLength: oldContent.length,
    newLength: newContent.length,
    timestamp: new Date().toISOString()
  });
}

/**
 * Creates a new document version after debounce period
 * This function is called when user stops typing for 5 seconds
 */
export async function createDebouncedDocumentVersion({
  documentId,
  content,
  userId
}: {
  documentId: string;
  content: string;
  userId: string;
}): Promise<(typeof schema.DocumentVersion.$inferSelect) | null> {
  try {
    const latestVersion = await getLatestDocumentVersionById({ id: documentId });
    
    if (!latestVersion || latestVersion.length === 0) {
      console.log(`[DB Query - createDebouncedDocumentVersion] No previous version found for doc ${documentId}, skipping version creation`);
      return null;
    }
    
    const previousVersion = latestVersion[0];
    
    if (previousVersion.content === content) {
      console.log(`[DB Query - createDebouncedDocumentVersion] Content unchanged for doc ${documentId}, skipping version creation`);
      return null;
    }
    
    const newVersion = await updateDocumentVersion({
      documentId,
      content,
      previousContent: previousVersion.content
    });
    
    console.log(`[DB Query - createDebouncedDocumentVersion] Created new version ${newVersion.version} for doc ${documentId}`);
    return newVersion;
    
  } catch (error) {
    console.error(`[DB Query - createDebouncedDocumentVersion] Error creating debounced version for doc ${documentId}:`, error);
    return null;
  }
}

/**
 * Get all versions for a document (both Document and DocumentVersion tables)
 * Returns a unified array of all versions for navigation
 */
export async function getAllDocumentVersions({
  documentId,
  userId
}: {
  documentId: string;
  userId: string;
}): Promise<Array<{
  id: string;
  content: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isCurrent: boolean;
  diffContent?: string;
}>> {
  try {
    const currentDocument = await getCurrentDocumentVersion({ userId, documentId });
    
    const historicalVersions = await db
      .select()
      .from(schema.DocumentVersion)
      .where(eq(schema.DocumentVersion.documentId, documentId))
      .orderBy(asc(schema.DocumentVersion.createdAt));
    
    const allVersions: Array<{
      id: string;
      content: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
      version: number;
      isCurrent: boolean;
      diffContent?: string;
    }> = [];
    
    historicalVersions.forEach((version, index) => {
      allVersions.push({
        id: version.id,
        content: version.content,
        title: currentDocument?.title || 'Untitled Document', // Use current document title
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        version: version.version,
        isCurrent: false,
        diffContent: version.diffContent || undefined
      });
    });
    
    if (currentDocument) {
      allVersions.push({
        id: currentDocument.id,
        content: currentDocument.content || '',
        title: currentDocument.title,
        createdAt: currentDocument.createdAt,
        updatedAt: currentDocument.updatedAt,
        version: historicalVersions.length + 1,
        isCurrent: true,
        diffContent: undefined
      });
    }
    
    console.log(`[DB Query - getAllDocumentVersions] Found ${allVersions.length} versions for doc ${documentId}`);
    return allVersions;
    
  } catch (error) {
    console.error(`[DB Query - getAllDocumentVersions] Error fetching all versions for doc ${documentId}:`, error);
    return [];
  }
}
export async function getLatestDocumentVersionById({ id }: { id: string }): Promise<(typeof schema.DocumentVersion.$inferSelect)[] | null> {
  try {
    const data = await db.select().from(schema.DocumentVersion).where(eq(schema.DocumentVersion.documentId, id)).orderBy(desc(schema.DocumentVersion.createdAt)).limit(1);
    return data;
  } catch (error) {
    console.error(`[DB Query - getLatestDocumentVersionById] Error fetching latest document version for doc ${id}:`, error);
    throw new Error(`Failed to fetch latest document version: ${error instanceof Error ? error.message : String(error)}`);

  }
}


export async function getDocumentsById({ ids, userId }: { ids: string[], userId: string }): Promise<Document[]> {
  if (!ids || ids.length === 0) {
    return [];
  }
  try {
    const data = await db.select()
      .from(schema.Document)
      .where(and(
        eq(schema.Document.userId, userId),
        eq(schema.Document.is_current, true),
        inArray(schema.Document.id, ids)
      ))
      .orderBy(asc(schema.Document.createdAt));
    return data || [];
  } catch (error) {
    console.error('Error fetching documents by IDs:', error);
    return [];
  }
}

export async function getDocumentById({ id }: { id: string }): Promise<Document | null> { 
  if (!id || id === 'undefined' || id === 'null' || id === 'init' ||
      id === 'current document' || id === 'current document ID' ||
      id.includes('current')) {
    console.warn(`[DB Query] Invalid document ID provided: ${id}`);
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    console.warn(`[DB Query] Document ID is not a valid UUID format: ${id}`);
    return null;
  }

  try {
    const data = await db.select()
      .from(schema.Document)
      .where(eq(schema.Document.id, id))
      .orderBy(desc(schema.Document.createdAt))
      .limit(1);

    if (!data || data.length === 0) {
      console.warn(`[DB Query] No document found with ID: ${id}`);
      return null;
    }

    return data[0];
  } catch (error) {
    console.error(`[DB Query] Error fetching document with ID ${id}:`, error);
    return null;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: string;
}) {
  try {
    const timestampDate = new Date(timestamp); 
    if (isNaN(timestampDate.getTime())) { 
        throw new Error("Invalid timestamp provided for deletion.");
    }
    
    // Delete DocumentVersion entries after timestamp
    await db.delete(schema.DocumentVersion)
      .where(and(
        eq(schema.DocumentVersion.documentId, id),
        gt(schema.DocumentVersion.createdAt, timestampDate) 
      ));
    
    // Delete Document entries after timestamp  
    await db.delete(schema.Document)
      .where(and(
        eq(schema.Document.id, id),
        gt(schema.Document.createdAt, timestampDate) 
      ));
      
    console.log(`[DB Query] Deleted all versions after ${timestampDate.toISOString()} for document ${id}`);
  } catch (error) {
    console.error('Error deleting documents:', error);
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: string | Date;
}) {
  try {
    const value =
      timestamp instanceof Date ? timestamp.toISOString() : timestamp;

    if (!value || typeof value !== 'string') {
      console.warn(
        `[DB Query - deleteMessagesByChatIdAfterTimestamp] Invalid timestamp provided for chat ${chatId}:`,
        timestamp
      );
      return;
    }

    await db
      .delete(schema.Message)
      .where(
        and(
          eq(schema.Message.chatId, chatId),
          gte(schema.Message.createdAt, value)
        )
      );
  } catch (error) {
    console.error('Error deleting messages:', error);
    throw error;
  }
}

export async function deleteMessagesAfterMessageId({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}) {
  try {
    const message = await db
      .select({ createdAt: schema.Message.createdAt })
      .from(schema.Message)
      .where(
        and(
          eq(schema.Message.id, messageId),
          eq(schema.Message.chatId, chatId)
        )
      )
      .limit(1);

    if (!message.length) {
      console.warn(`Message ${messageId} not found in chat ${chatId}`);
      return;
    }

    const messageTimestamp = message[0].createdAt;

    await db
      .delete(schema.Message)
      .where(
        and(
          eq(schema.Message.chatId, chatId),
          gte(schema.Message.createdAt, messageTimestamp)
        )
      );
  } catch (error) {
    console.error('Error deleting messages after message ID:', error);
    throw error;
  }
}

export async function updateChatContextQuery({
  chatId,
  userId,
  context,
}: {
  chatId: string;
  userId: string;
  context: { active?: string; mentioned?: string[] }; 
}) {
  try {
    await db.update(schema.Chat)
      .set({ document_context: context })
      .where(
        and(
          eq(schema.Chat.id, chatId),
          eq(schema.Chat.userId, userId) 
        )
      );
  } catch (error) {
    console.error('Error updating chat context:', error);
    throw error; 
  }
}

export async function getCurrentDocumentsByUserId({ userId }: { userId: string }): Promise<Pick<Document, 'id' | 'title' | 'createdAt' | 'kind'>[]> {
  try {
    const data = await db.select({
        id: schema.Document.id,
        title: schema.Document.title,
        createdAt: schema.Document.createdAt,
        kind: schema.Document.kind,
      })
      .from(schema.Document)
      .where(
        and(
          eq(schema.Document.userId, userId),
          eq(schema.Document.is_current, true) 
        )
      )
      .orderBy(desc(schema.Document.createdAt));
    return data || [];
  } catch (error) {
    console.error('Error fetching current documents by user ID:', error);
    return []; 
  }
}

export async function getPaginatedDocumentsByUserId({
  userId,
  limit,
  endingBefore,
}: {
  userId: string;
  limit: number;
  endingBefore: string | null;
}): Promise<{ documents: Pick<Document, 'id' | 'title' | 'createdAt' | 'kind'>[], hasMore: boolean }> {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: any) =>
      db
        .select({
          id: schema.Document.id,
          title: schema.Document.title,
          createdAt: schema.Document.createdAt,
          kind: schema.Document.kind,
        })
        .from(schema.Document)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(schema.Document.userId, userId),
                eq(schema.Document.is_current, true)
              )
            : and(
                eq(schema.Document.userId, userId),
                eq(schema.Document.is_current, true)
              )
        )
        .orderBy(desc(schema.Document.createdAt))
        .limit(extendedLimit);

    let paginatedDocs: Pick<Document, 'id' | 'title' | 'createdAt' | 'kind'>[] = [];

    if (endingBefore) {
      // Find the cursor document to get its creation date
      const [cursorDoc] = await db
        .select({ createdAt: schema.Document.createdAt })
        .from(schema.Document)
        .where(eq(schema.Document.id, endingBefore))
        .limit(1);

      if (!cursorDoc) {
        // If cursor doesn't exist, maybe return empty or handle error
        return { documents: [], hasMore: false };
      }

      paginatedDocs = await query(lt(schema.Document.createdAt, cursorDoc.createdAt));
    } else {
      // First page
      paginatedDocs = await query();
    }

    const hasMore = paginatedDocs.length > extendedLimit -1;

    return {
      documents: hasMore ? paginatedDocs.slice(0, limit) : paginatedDocs,
      hasMore,
    };
  } catch (error) {
    console.error(`[DB Query - getPaginatedDocuments] Error fetching paginated documents for user ${userId}:`, error);
    throw error;
  }
}

export async function searchDocumentsByQuery({ 
  userId, 
  query, 
  limit = 5 
}: { 
  userId: string; 
  query: string; 
  limit?: number;
}): Promise<Document[]> {
  try {
    const data = await db.select()
      .from(schema.Document)
      .where(
        and(
          eq(schema.Document.userId, userId),
          eq(schema.Document.is_current, true),
          sql`(${schema.Document.title} ilike ${`%${query}%`} or ${schema.Document.content} ilike ${`%${query}%`})`
        )
      )
      .orderBy(desc(schema.Document.createdAt))
      .limit(limit);
    return data || [];
  } catch (error) {
    console.error('Error searching documents by query:', error);
    return [];
  }
}

export async function getCurrentDocumentByTitle({ 
  userId, 
  title 
}: { 
  userId: string; 
  title: string 
}): Promise<Document | null> {
  try {
    const data = await db.select()
      .from(schema.Document)
      .where(
        and(
          eq(schema.Document.userId, userId),
          eq(schema.Document.is_current, true),
          sql`${schema.Document.title} ilike ${title}` 
        )
      )
      .orderBy(desc(schema.Document.createdAt)) 
      .limit(1);
    return data[0] || null;
  } catch (error) {
    console.error('Error fetching current document by title:', error);
    return null;
  }
}

export async function checkDocumentOwnership({ 
  userId, 
  documentId 
}: { 
  userId: string; 
  documentId: string 
}): Promise<boolean> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.Document)
      .where(and(
        eq(schema.Document.id, documentId),
        eq(schema.Document.userId, userId)
      ))
      .limit(1); // Optimization

    return result[0]?.count > 0;
  } catch (error) {
    console.error(`[DB Query - checkDocumentOwnership] Error checking ownership for doc ${documentId}, user ${userId}:`, error);
    // Assume false on error to be safe
    return false;
  }
}

export async function deleteDocumentByIdAndUserId({ 
  userId, 
  documentId 
}: { 
  userId: string; 
  documentId: string 
}): Promise<void> {
  try {
    const ownsDocument = await checkDocumentOwnership({ userId, documentId });
    if (!ownsDocument) {
      console.warn(`User ${userId} attempted to delete document ${documentId} they don't own.`);
      throw new Error('Unauthorized or document not found'); 
    }

    await db.delete(schema.Document)
      .where(
        and(
          eq(schema.Document.id, documentId),
          eq(schema.Document.userId, userId)  
        )
      );
    console.log(`Deleted all versions of document ${documentId} for user ${userId}`);
  } catch (error) {
    console.error('Error deleting document by ID and User ID:', error);
    throw error; 
  }
}

export async function renameDocumentTitle({ 
  userId, 
  documentId, 
  newTitle 
}: { 
  userId: string; 
  documentId: string; 
  newTitle: string; 
}): Promise<void> {
  try {
    const ownsDocument = await checkDocumentOwnership({ userId, documentId });
    if (!ownsDocument) {
      console.warn(`User ${userId} attempted to rename document ${documentId} they don't own.`);
      throw new Error('Unauthorized or document not found'); 
    }

    await db.update(schema.Document)
      .set({ title: newTitle, updatedAt: new Date() })
      .where(
        and(
          eq(schema.Document.id, documentId),
          eq(schema.Document.userId, userId) 
        )
      );
    console.log(`Renamed document ${documentId} to "${newTitle}" for user ${userId}`);

  } catch (error) {
    console.error('Error renaming document title:', error); 
    throw error; 
  }
}

export async function getCurrentDocumentVersion({ 
  userId, 
  documentId 
}: { 
  userId: string; 
  documentId: string 
}): Promise<(typeof schema.Document.$inferSelect) | null> {
  try {
    const results = await db
      .select()
      .from(schema.Document)
      .where(and(
        eq(schema.Document.id, documentId),
        eq(schema.Document.userId, userId),
        eq(schema.Document.is_current, true)
      ))
      .limit(1); 

    return results[0] || null;
  } catch (error) {
    console.error(`[DB Query - getCurrentDocumentVersion] Error fetching current version for doc ${documentId}, user ${userId}:`, error);
    throw new Error(`Failed to fetch current document version: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updateCurrentDocumentVersion({
  userId,
  documentId,
  content,
}: {
  userId: string;
  documentId: string;
  content: string;
}): Promise<(typeof schema.Document.$inferSelect) | null> {
  try {
    const updatedDocs = await db
      .update(schema.Document)
      .set({ 
        content: content, 
        updatedAt: new Date(),
      })
      .where(and(
        eq(schema.Document.id, documentId),
        eq(schema.Document.userId, userId),
        eq(schema.Document.is_current, true) 
      ))
      .returning(); 
      
    if (updatedDocs.length === 0) {
        console.warn(`[DB Query - updateCurrentDocumentVersion] No current document found to update for doc ${documentId}, user ${userId}.`);
        const anyVersionExists = await db.select({ id: schema.Document.id })
                                       .from(schema.Document)
                                       .where(and(eq(schema.Document.id, documentId), eq(schema.Document.userId, userId)))
                                       .limit(1);
        if (anyVersionExists.length === 0) {
            throw new Error('Document not found or unauthorized.');
        } else {
            throw new Error('Failed to update the current document version. It might have been changed or deleted.');
        }
    }
      
    console.log(`[DB Query - updateCurrentDocumentVersion] Updated content for current version of doc ${documentId}, user ${userId}`);
    return updatedDocs[0];

  } catch (error) {
    console.error(`[DB Query - updateCurrentDocumentVersion] Error updating current version for doc ${documentId}, user ${userId}:`, error);
    if (error instanceof Error && (error.message === 'Document not found or unauthorized.' || error.message.startsWith('Failed to update'))) {
        throw error;
    }
    throw new Error(`Failed to update current document version: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getChatExists({ chatId }: { chatId: string }): Promise<boolean> {
  try {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!chatId || !uuidRegex.test(chatId)) {
      console.warn(`[DB Query - getChatExists] Invalid chat ID format provided: ${chatId}`);
      return false;
    }
  
    const result = await db
      .select({ id: schema.Chat.id })
      .from(schema.Chat)
      .where(eq(schema.Chat.id, chatId))
      .limit(1);
      
    return result.length > 0;
  } catch (error) {
    console.error(`[DB Query - getChatExists] Error checking chat ${chatId}:`, error);
    return false; 
  }
}

// --- Subscription Queries --- //

// Define the type for the subscription based on your schema
type Subscription = typeof schema.subscription.$inferSelect;

/**
 * Fetches the active or trialing subscription for a given user ID.
 * @param userId - The ID of the user.
 * @returns The subscription object or null if none found or error.
 */
export async function getActiveSubscriptionByUserId({ userId }: { userId: string }): Promise<Subscription | null> {
  if (!userId) {
    console.warn('[DB Query - getActiveSubscriptionByUserId] No userId provided.');
    return null;
  }

  try {
    const data = await db
      .select()
      .from(schema.subscription)
      .where(
        and(
          eq(schema.subscription.referenceId, userId),
          inArray(schema.subscription.status, ['active', 'trialing'])
        )
      )
      .orderBy(desc(schema.subscription.createdAt))
      .limit(1);

    return data[0] || null;
  } catch (error) {
    console.error(`[DB Query - getActiveSubscriptionByUserId] Error fetching active subscription for user ${userId}:`, error);
    return null;
  }
}

// Add publish settings update
export async function updateDocumentPublishSettings({
  documentId,
  userId,
  visibility,
  author,
  style,
  slug,
}: {
  documentId: string;
  userId: string;
  visibility: 'public' | 'private';
  author: string;
  style: { theme: string; font?: string };
  slug: string;
}): Promise<(typeof schema.Document.$inferSelect)> {
  return await db.transaction(async (tx) => {
    // prevent slug collision with other documents
    if (slug) {
      const dup = await tx
        .select({ id: schema.Document.id })
        .from(schema.Document)
        .where(
          and(
            eq(schema.Document.userId, userId),
            eq(schema.Document.slug, slug),
            sql`"Document"."id" <> ${documentId}`
          )
        )
        .limit(1);

      if (dup.length) throw new Error('A document with this name is already published');
    }

    // clear slug on old versions to satisfy unique index
    await tx
      .update(schema.Document)
      .set({ slug: null })
      .where(
        and(
          eq(schema.Document.id, documentId),
          eq(schema.Document.userId, userId),
          eq(schema.Document.is_current, false)
        )
      );

    const [result] = await tx
      .update(schema.Document)
      .set({ visibility, author, style, slug })
      .where(
        and(
          eq(schema.Document.id, documentId),
          eq(schema.Document.userId, userId),
          eq(schema.Document.is_current, true)
        )
      )
      .returning();

    if (!result) throw new Error('Failed to update publish settings');
    return result;
  });
}

// Add username availability check
export async function checkUsernameAvailability({ username }: { username: string }): Promise<boolean> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.user)
    .where(eq(schema.user.username, username));
  return Number(count) === 0;
}

// Add set username for a user
export async function setUsername({ userId, username }: { userId: string; username: string }): Promise<void> {
  await db
    .update(schema.user)
    .set({ username })
    .where(eq(schema.user.id, userId));
}

export async function clearUsername({ userId }: { userId: string }): Promise<void> {
  await db
    .update(schema.user)
    .set({ username: null })
    .where(eq(schema.user.id, userId));
}

export async function unpublishAllDocumentsByUserId({ userId }: { userId: string }): Promise<void> {
  try {
    const updated = await db
      .update(schema.Document)
      .set({ visibility: 'private', slug: null, updatedAt: new Date() })
      .where(
        and(
          eq(schema.Document.userId, userId),
          eq(schema.Document.visibility, 'public')
        )
      )
      .returning({ id: schema.Document.id });
    
    if (updated.length > 0) {
      console.log(`[DB Query - unpublishAllDocumentsByUserId] Un-published ${updated.length} documents for user ${userId}.`);
    }
  } catch (error) {
    console.error(`[DB Query - unpublishAllDocumentsByUserId] Error un-publishing documents for user ${userId}:`, error);
    throw new Error('Failed to un-publish documents.');
  }
}

/**
 * Fork a document with version history up to a specific timestamp
 * Creates a new document with all historical versions up to the fork point
 */
export async function forkDocumentWithHistory({
  originalDocumentId,
  forkFromTimestamp,
  newDocumentId,
  newTitle,
  userId,
  chatId = null
}: {
  originalDocumentId: string;
  forkFromTimestamp: string;
  newDocumentId: string;
  newTitle: string;
  userId: string;
  chatId?: string | null;
}): Promise<(typeof schema.Document.$inferSelect)> {
  return await db.transaction(async (tx) => {
    // Get all versions of the original document up to the fork point
    const allVersions = await getAllDocumentVersions({ 
      documentId: originalDocumentId, 
      userId 
    });
    
    const forkTime = new Date(forkFromTimestamp).getTime();
    const versionsUpToFork = allVersions.filter(v => {
      const versionTime = new Date(v.createdAt).getTime();
      return versionTime <= forkTime;
    });
    
    if (versionsUpToFork.length === 0) {
      throw new Error('No versions found up to fork point');
    }
    
    // Sort by creation time to maintain order
    versionsUpToFork.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Create the new forked document (will be the "current" version)
    const latestVersionAtFork = versionsUpToFork[versionsUpToFork.length - 1];
    const now = new Date();
    
    const forkedDocument = await tx
      .insert(schema.Document)
      .values({
        id: newDocumentId,
        title: newTitle,
        content: latestVersionAtFork.content,
        userId,
        chatId,
        is_current: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    
    // Create DocumentVersion entries for all historical versions up to fork point
    for (let i = 0; i < versionsUpToFork.length; i++) {
      const version = versionsUpToFork[i];
      const previousVersionId = i > 0 ? versionsUpToFork[i - 1].id : null;
      
      await tx.insert(schema.DocumentVersion).values({
        documentId: newDocumentId,
        content: version.content,
        version: i + 1,
        previousVersionId,
        createdAt: new Date(version.createdAt),
        updatedAt: new Date(version.updatedAt),
      });
    }
    
    console.log(`[DB Query - forkDocumentWithHistory] Created fork ${newDocumentId} with ${versionsUpToFork.length} historical versions`);
    
    if (!forkedDocument || forkedDocument.length === 0) {
      throw new Error('Failed to create forked document');
    }
    
    return forkedDocument[0];
  });
}

export async function deleteMessageById({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}) {
  try {
    await db
      .delete(schema.Message)
      .where(and(eq(schema.Message.chatId, chatId), eq(schema.Message.id, messageId)));
  } catch (error) {
    console.error('Error deleting message by ID:', error);
    throw error;
  }
}

export async function addToWaitlist({ email }: { email: string }): Promise<void> {
  try {
    await db.insert(schema.waitlist).values({
      email,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    throw error;
  }
}

export async function getWaitlistCount(): Promise<number> {
  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.waitlist);
    return Number(count);
  } catch (error) {
    console.error('Error getting waitlist count:', error);
    return 0;
  }
}

export async function checkEmailInWaitlist({ email }: { email: string }): Promise<boolean> {
  try {
    const result = await db
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.email, email))
      .limit(1);
    return result.length > 0;
  } catch (error) {
    console.error('Error checking email in waitlist:', error);
    return false;
  }
}
