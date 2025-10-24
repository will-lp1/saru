import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { updateDocument } from "@/lib/ai/tools/update-document";
import type { streamingDocument } from "@/lib/ai/tools/document-streaming";
import type { webSearch } from "@/lib/ai/tools/web-search";

export type ActiveDocumentId = string | undefined;

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

export type DataPart = { type: "append-message"; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type streamingDocumentTool = InferUITool<ReturnType<typeof streamingDocument>>;
type webSearchTool = InferUITool<ReturnType<typeof webSearch>>;

export type ChatTools = {
  updateDocument: updateDocumentTool;
  streamingDocument: streamingDocumentTool;
  webSearch: webSearchTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  kind: string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;
