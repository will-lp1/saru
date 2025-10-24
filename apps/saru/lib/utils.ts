import type {
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { Message as DBMessage, Document } from '@saru/db';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from '@/types/chat';


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


export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: ((message as any).parts ||
            (message.content as any)?.parts ||
            []) as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}



export function convertUIMessageToDBFormat(
  message: UIMessage,
  chatId: string,
  reasoningText?: string
): {
  id: string;
  chatId: string;
  role: string;
  content: { parts: UIMessage['parts'] };
  createdAt: string;
} {
  const parts: UIMessage['parts'] = [...(message.parts || [])];

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
    content: { parts }, 
    createdAt: new Date().toISOString(),
  };
}


export function getMostRecentUserMessage(messages: Array<UIMessage>) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}


export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}


export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');
}


const DB_NAME = 'saru-cache';
const DB_VERSION = 1;
const VERSIONS_STORE = 'document-versions';

interface CachedVersion {
  documentId: string;
  versions: unknown[];
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

export const versionCache = new VersionCache();
