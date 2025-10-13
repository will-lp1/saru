export type ActiveDocumentId = string | null;

export interface ChatContextPayload {
  activeDocumentId?: ActiveDocumentId;
  mentionedDocumentIds?: string[];
}

export interface ChatAiOptions {
  customInstructions?: string | null;
  suggestionLength?: 'short' | 'medium' | 'long';
  writingStyleSummary?: string | null;
  applyStyle?: boolean;
}
