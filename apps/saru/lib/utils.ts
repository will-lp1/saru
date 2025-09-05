import type {
  UIMessage,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import type { Message as DBMessage, Document } from '@saru/db';

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

// function addToolMessageToChat({
//   toolMessage,
//   messages,
// }: {
//   toolMessage: CoreToolMessage;
//   messages: Array<UIMessage>;
// }): Array<UIMessage> {
//   return messages.map((message) => {
//     if (message.toolInvocations) {
//       return {
//         ...message,
//         toolInvocations: message.toolInvocations.map((toolInvocation) => {
//           const toolResult = toolMessage.content.find(
//             (tool) => tool.toolCallId === toolInvocation.toolCallId,
//           );

//           if (toolResult) {
//             return {
//               ...toolInvocation,
//               state: 'result',
//               result: toolResult.result,
//             };
//           }

//           return toolInvocation;
//         }),
//       };
//     }

//     return message;
//   });
// }

export function convertToUIMessages(
  messages: Array<DBMessage>,
): Array<UIMessage> {
  const processedMessages: Array<UIMessage> = [];

  for (const message of messages) {
    if (message.role === 'tool') {
      continue;
    }

    const parts: UIMessage['parts'] = [];
    let textContent = '';
    
    const messageContent = message.content as any;
    const messageParts = messageContent.parts || []

    for (const part of messageParts) {
      switch(part.type) {
        case 'text':
          textContent += part.text || '';
          parts.push({
            type: 'text',
            text: part.text || '',
            state: part.state,
            providerMetadata: part.providerMetadata
          })
          break;

        case 'reasoning':
          parts.push({
            type: 'reasoning',
            text: part.text || '',
            state: part.state,
            providerMetadata: part.providerMetadata
          });
          break;

        case 'source-url':
          parts.push({
            type: 'source-url',
            sourceId: part.sourceId,
            url: part.url,
            title: part.title,
            providerMetadata: part.providerMetadata
          });
        break;

        case 'source-document':
          parts.push({
            type: 'source-document',
            sourceId: part.sourceId,
            mediaType: part.mediaType,
            title: part.title,
            filename: part.filename,
            providerMetadata: part.providerMetadata
          });
          break;

        case 'file':
          parts.push({
            type: 'file',
            mediaType: part.mediaType,
            filename: part.filename,
            url: part.url,
            providerMetadata: part.providerMetadata
          });
          break;

        case 'step-start':
          parts.push({
            type: 'step-start'
          });
          break;

          default:
          // Handle tool parts (tool-*) and data parts (data-*)
          if (part.type?.startsWith('tool-')) {
            parts.push({
              type: part.type,
              toolCallId: part.toolCallId,
              state: part.state,
              input: part.input,
              output: part.output,
              errorText: part.errorText,
              providerExecuted: part.providerExecuted,
              callProviderMetadata: part.callProviderMetadata,
              preliminary: part.preliminary,
              rawInput: part.rawInput
            });
          } else if (part.type?.startsWith('data-')) {
            parts.push({
              type: part.type,
              id: part.id,
              data: part.data
            });
          } else {
            // Pass through any unknown part types
            parts.push(part);
          }
          break;
        
      }
    }

    processedMessages.push({
      id: message.id,
      role: message.role as UIMessage['role'],
      parts: parts,
    });
  }

  return processedMessages;
}


// export function sanitizeResponseMessages({
//   messages,
//   reasoningText,
// }: {
//   messages: Array<DBMessage>;
//   reasoningText: string | undefined;
// }): Array<DBMessage> {
//   const toolResultIds: Array<string> = [];

//   // Collect all tool call IDs that have corresponding results
//   for (const message of messages) {
//     const messageContent = message.content as any;
//     const parts = messageContent?.parts || [];

//     for (const part of parts) {
//       if (part.type?.startsWith('tool-') && part.state === 'output-available' && part.toolCallId) {
//         toolResultIds.push(part.toolCallId);
//       }
//     }
//   }

//   const sanitizedMessages = messages.map((message) => {
//     const messageContent = message.content as any;
//     const parts = messageContent?.parts || [];

//     const sanitizedParts = parts.filter((part: any) => {
//       // Filter tool parts: only keep those that have corresponding results
//       if (part.type?.startsWith('tool-')) {
//         return toolResultIds.includes(part.toolCallId);
//       }
      
//       // Filter text parts: only keep those with non-empty text
//       if (part.type === 'text') {
//         return part.text && part.text.length > 0;
//       }
      
//       // Keep all other part types
//       return true;
//     });

//     // Add reasoning part if provided
//     if (reasoningText && message.role === 'assistant') {
//       sanitizedParts.push({
//         type: 'reasoning',
//         text: reasoningText
//       });
//     }

//     return {
//       ...message,
//       content: {
//         ...messageContent,
//         parts: sanitizedParts
//       }
//     };
//   });

//   // Filter out messages with no parts
//   return sanitizedMessages.filter((message) => {
//     const messageContent = message.content as any;
//     const parts = messageContent?.parts || [];
//     return parts.length > 0;
//   });
// }

// Convert UIMessage to database format
export function convertUIMessageToDBFormat(
  message: UIMessage,
  chatId: string,
  reasoningText?: string
): {
  id: string;
  chatId: string;
  role: string;
  content: any;
  createdAt: string;
} {
  const parts: any[] = [...(message.parts || [])];

  // Add reasoning text to assistant messages if provided
  if (reasoningText && message.role === 'assistant') {
    parts.push({
      type: 'reasoning',
      text: reasoningText
    });
  }

  return {
    id: message.id || generateUUID(),
    chatId,
    role: message.role,
    content: { parts }, // Store parts in content as jsonb
    createdAt: new Date().toISOString(),
  };
}

export function sanitizeUIMessages(messages: Array<UIMessage>): Array<UIMessage> {
  const sanitizedMessages = messages.map((message) => {
    if (message.role !== 'assistant') return message;

    const parts = message.parts || [];
    
    // Collect all tool call IDs that have results
    const toolResultIds: Array<string> = [];
    
    for (const part of parts) {
      if (part.type?.startsWith('tool-') && 'state' in part && 'toolCallId' in part) {
        if (part.state === 'output-available' && part.toolCallId) {
          toolResultIds.push(part.toolCallId);
        }
      }
    }

    // Filter parts: only keep tool parts that have results or are results themselves
    const sanitizedParts = parts.filter((part) => {
      if (part.type?.startsWith('tool-') && 'state' in part && 'toolCallId' in part) {
        return part.state === 'output-available' || toolResultIds.includes(part.toolCallId);
      }
      return true; // Keep all non-tool parts
    });

    return {
      ...message,
      parts: sanitizedParts,
    };
  });

  // Filter out messages with no parts
  return sanitizedMessages.filter((message) => {
    const parts = message.parts || [];
    return parts.length > 0;
  });
}

export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Array<Document>,
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
const DB_NAME = 'saru-cache';
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
