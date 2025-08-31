import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DbChatMessage, ChatMessage, ChatParts } from './types';
import { convertToModelMessages } from 'ai';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
  info: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url);

  if (!res.ok) {
    const error = new Error(
      'An error occurred while fetching the data.',
    ) as ApplicationError;

    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
};

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Convert database messages (with parts array) to UI messages
 */
export function convertToUIMessages(
  messages: Array<DbChatMessage>,
): Array<ChatMessage> {
  return messages
    .filter(message => message.role !== 'tool') // Filter out tool messages at DB level
    .map((message) => ({
      id: message.id,
      role: message.role as ChatMessage['role'],
      parts: message.content,
      createdAt: message.createdAt,
    }));
}

/**
 * Convert UI messages to model messages for AI SDK
 */
export function convertUIToModelMessages(messages: Array<ChatMessage>) {
  return convertToModelMessages(messages);
}

/**
 * Get the most recent user message from a conversation
 */
export function getMostRecentUserMessage(messages: Array<ChatMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

/**
 * Extract text content from message parts
 */
export function getTextFromParts(parts: ChatParts): string {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * Extract text content from a message (compatibility helper)
 */
export function getTextFromMessage(message: ChatMessage): string {
  return getTextFromParts(message.parts || []);
}

/**
 * Extract reasoning text from message parts
 */
export function getReasoningFromParts(parts: ChatParts): string | undefined {
  const reasoningPart = parts.find((part) => part.type === 'reasoning');
  return reasoningPart?.text;
}

/**
 * Get tool invocations from message parts
 */
export function getToolInvocationsFromParts(parts: ChatParts) {
  return parts
    .filter((part) => part.type.startsWith('tool-') && 'toolCallId' in part)
    .map((part: any) => ({
      toolCallId: part.toolCallId,
      toolName: part.toolName || part.type.replace('tool-', ''),
      args: part.input || part.args,
      state: part.state || 'call' as const,
    }));
}

/**
 * Get tool results from message parts  
 */
export function getToolResultsFromParts(parts: ChatParts) {
  return parts
    .filter((part) => part.type.startsWith('tool-') && 'output' in part)
    .map((part: any) => ({
      toolCallId: part.toolCallId,
      toolName: part.toolName || part.type.replace('tool-', ''),
      result: part.output || part.result,
      state: 'result' as const,
    }));
}

/**
 * Create a text part
 */
export function createTextPart(text: string) {
  return { type: 'text' as const, text };
}

/**
 * Create a reasoning part
 */
export function createReasoningPart(text: string) {
  return { type: 'reasoning' as const, text };
}

/**
 * Create a tool call part
 */
export function createToolCallPart(toolCallId: string, toolName: string, args: any) {
  return {
    type: 'tool-call' as const,
    toolCallId,
    toolName,
    args,
  };
}

/**
 * Create a tool result part
 */
export function createToolResultPart(toolCallId: string, toolName: string, result: any) {
  return {
    type: 'tool-result' as const,
    toolCallId,
    toolName,
    result,
  };
}

/**
 * Legacy helper for backward compatibility - converts old content format to parts
 */
export function parseMessageContent(content: any): ChatParts {
  if (Array.isArray(content)) {
    return content;
  }
  
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, treat as plain text
    }
    return [createTextPart(content)];
  }
  
  // If it's an object, wrap it in an array
  return [content];
}

/**
 * Sanitize response messages for storage - clean up tool calls without results
 */
export function sanitizeResponseMessages(messages: Array<any>) {
  return messages.filter((message) => {
    if (message.role === 'assistant' && Array.isArray(message.parts)) {
      // Keep assistant messages that have text or completed tool calls
      const hasText = message.parts.some((part: any) => part.type === 'text' && part.text?.length > 0);
      const hasToolCalls = message.parts.some((part: any) => part.type === 'tool-call');
      const hasToolResults = message.parts.some((part: any) => part.type === 'tool-result');
      
      // Only keep if it has text or if tool calls have corresponding results
      return hasText || (hasToolCalls && hasToolResults);
    }
    return true;
  });
}

/**
 * Sanitize UI messages - remove incomplete tool calls and empty messages
 */
export function sanitizeUIMessages(messages: Array<ChatMessage>) {
  return messages.filter((message) => {
    if (message.role === 'assistant' && Array.isArray(message.parts)) {
      // Keep assistant messages that have text or completed tool calls
      const hasText = message.parts.some((part: any) => part.type === 'text' && part.text?.length > 0);
      const hasToolCalls = message.parts.some((part: any) => part.type?.startsWith('tool-') && part.state !== 'result');
      const hasToolResults = message.parts.some((part: any) => part.type?.startsWith('tool-') && part.state === 'result');
      
      // Only keep if it has text or if tool calls have corresponding results
      return hasText || (hasToolCalls && hasToolResults);
    }
    return true;
  });
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function getDocumentTimestampByIndex(
  documents: Array<any>,
  index: number,
) {
  if (!documents) return new Date();
  if (index > documents.length) return new Date();

  return documents[index].createdAt;
}

interface MessageContent {
  type: 'text' | 'tool_call' | 'tool_result';
  content: any;
  order: number;
}

export function parseMessageContent(content: any): MessageContent[] {
  if (typeof content === 'string') {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => {
          // Normalize type names
          const type = (item.type === 'tool-call' ? 'tool_call' : 
                       item.type === 'tool-result' ? 'tool_result' : 
                       item.type || 'text') as MessageContent['type'];
          
          // For tool results, ensure proper structure
          if (type === 'tool_result') {
            return {
              type,
              content: {
                type: 'tool_result',
                toolCallId: item.toolCallId || item.content?.toolCallId,
                toolName: item.toolName || item.content?.toolName,
                result: item.result || item.content?.result
              },
              order: index
            };
          }
          
          // For tool calls, ensure proper structure
          if (type === 'tool_call') {
            return {
              type,
              content: {
                type: 'tool_call',
                toolCallId: item.toolCallId || item.content?.toolCallId,
                toolName: item.toolName || item.content?.toolName,
                args: item.args || item.content?.args
              },
              order: index
            };
          }
          
          // For text content
          return {
            type,
            content: item.text || item.content || item,
            order: index
          };
        });
      }
      // If parsed but not an array, treat as single text content
      return [{
        type: 'text',
        content: parsed,
        order: 0,
      }];
    } catch {
      // If not valid JSON, treat as plain text
      return [{
        type: 'text',
        content: content,
        order: 0,
      }];
    }
  }

  if (Array.isArray(content)) {
    return content.map((item, index) => {
      // Normalize type names
      const type = (item.type === 'tool-call' ? 'tool_call' : 
                   item.type === 'tool-result' ? 'tool_result' : 
                   item.type || 'text') as MessageContent['type'];
      
      // For tool results, ensure proper structure
      if (type === 'tool_result') {
        return {
          type,
          content: {
            type: 'tool_result',
            toolCallId: item.toolCallId || item.content?.toolCallId,
            toolName: item.toolName || item.content?.toolName,
            result: item.result || item.content?.result
          },
          order: index
        };
      }
      
      // For tool calls, ensure proper structure
      if (type === 'tool_call') {
        return {
          type,
          content: {
            type: 'tool_call',
            toolCallId: item.toolCallId || item.content?.toolCallId,
            toolName: item.toolName || item.content?.toolName,
            args: item.args || item.content?.args
          },
          order: index
        };
      }
      
      // For text content
      return {
        type,
        content: item.text || item.content || item,
        order: index
      };
    });
  }

  // If object or other type, wrap in array
  return [{
    type: 'text',
    content: content,
    order: 0,
  }];
}

// IndexedDB utilities for caching document versions
const DB_NAME = 'snow-leopard-cache';
const DB_VERSION = 1;
const VERSIONS_STORE = 'document-versions';

interface CachedVersion {
  documentId: string;
  versions: any[];
  timestamp: number;
  userId: string;
}

class VersionCache {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
          db.createObjectStore(VERSIONS_STORE, { keyPath: 'documentId' });
        }
      };
    });
  }

  async getVersions(documentId: string, userId: string): Promise<any[] | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VERSIONS_STORE], 'readonly');
      const store = transaction.objectStore(VERSIONS_STORE);
      const request = store.get(documentId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cached: CachedVersion | undefined = request.result;
        if (cached && cached.userId === userId) {
          // Check if cache is still valid (5 minutes)
          const isExpired = Date.now() - cached.timestamp > 5 * 60 * 1000;
          if (!isExpired) {
            resolve(cached.versions);
            return;
          }
        }
        resolve(null);
      };
    });
  }

  async setVersions(documentId: string, versions: any[], userId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VERSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(VERSIONS_STORE);
      const request = store.put({
        documentId,
        versions,
        timestamp: Date.now(),
        userId
      });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async invalidateVersions(documentId: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VERSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(VERSIONS_STORE);
      const request = store.delete(documentId);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([VERSIONS_STORE], 'readwrite');
      const store = transaction.objectStore(VERSIONS_STORE);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Export singleton instance
export const versionCache = new VersionCache();
}
