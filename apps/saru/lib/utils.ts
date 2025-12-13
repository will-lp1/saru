import type {
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { Message as DBMessage, Document } from '@saru/db';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from '@/types/chat';

type ChatRole = 'user' | 'assistant' | 'system';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isChatRole(value: unknown): value is ChatRole {
  return value === 'user' || value === 'assistant' || value === 'system';
}

type LegacyStoredTextItem = {
  type: 'text';
  content: string;
  order?: number;
};

function isLegacyStoredTextItem(value: unknown): value is LegacyStoredTextItem {
  if (!isRecord(value)) return false;
  return value.type === 'text' && typeof value.content === 'string';
}

type PartsContainer = { parts: unknown[] };
function isPartsContainer(value: unknown): value is PartsContainer {
  return isRecord(value) && Array.isArray(value.parts);
}

type TextPart = { type: 'text'; text: string };
function isTextPart(value: unknown): value is TextPart {
  if (!isRecord(value)) return false;
  return value.type === 'text' && typeof value.text === 'string';
}

// Best-effort validation for arbitrary UI message parts.
function toSafeParts(
  value: unknown
): UIMessagePart<CustomUIDataTypes, ChatTools>[] {
  if (!Array.isArray(value)) return [];

  const parts: UIMessagePart<CustomUIDataTypes, ChatTools>[] = [];
  for (const item of value) {
    // Keep well-formed text parts.
    if (isTextPart(item)) {
      parts.push(item);
      continue;
    }

    // Keep any object with a string `type` (covers tool parts, reasoning parts, etc.).
    if (isRecord(item) && typeof item.type === 'string') {
      parts.push(item as unknown as UIMessagePart<CustomUIDataTypes, ChatTools>);
    }
  }
  return parts;
}


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
    role: isChatRole(message.role) ? message.role : 'assistant',
    parts: (() => {
      const content: unknown = message.content;

      // Preferred format: { parts: UIMessagePart[] }
      if (isPartsContainer(content)) {
        return toSafeParts(content.parts);
      }

      // Legacy format: plain string content
      if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
      }

      // Legacy format: [{ type: 'text', content: '...' }, ...]
      if (Array.isArray(content)) {
        const mapped = content
          .filter(isLegacyStoredTextItem)
          .map((item) => ({ type: 'text', text: item.content } satisfies TextPart));
        return mapped;
      }

      return [];
    })(),
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
  if (!documents || index < 0 || index >= documents.length) {
    return new Date();
  }

  return documents[index].createdAt;
}


export function getTextFromMessage(message: ChatMessage): string {
  const parts = message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[];
  return parts
    .filter(isTextPart)
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

  async getVersions<T = unknown>(documentId: string, userId: string): Promise<T[] | null> {
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
            resolve(cached.versions as T[]);
            return;
          }
        }
        resolve(null);
      };
    });
  }

  async setVersions<T = unknown>(documentId: string, versions: T[], userId: string): Promise<void> {
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
