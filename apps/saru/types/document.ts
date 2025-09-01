import { DocumentMetadata } from './metadata';

export interface DocumentContent<T extends DocumentMetadata = DocumentMetadata> {
  title: string;
  content: string;
  mode: 'edit' | 'diff';
  status: 'streaming' | 'idle';
  currentVersionIndex: number;
  suggestions: Array<string>;
  onSaveContent: (content: string, isDebounced?: boolean) => void;
  isInline: boolean;
  isCurrentVersion: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: T;
  setMetadata: (metadata: T) => void;
  documentId: string;
  saveState: 'idle' | 'saving' | 'error';
  lastSaveError: string | null;
}

export interface UIDocument {
  documentId: string;
  content: string;
  title: string;
  status: 'idle' | 'loading' | 'streaming';
} 