import { z } from 'zod';
import type { createDocument } from './ai/tools/create-document';
import type { updateDocument } from './ai/tools/update-document';
import type { webSearch } from './ai/tools/web-search';
import type { InferUITool, UIMessage, UIMessagePart } from 'ai';

import type { Document } from '@snow-leopard/db';

export type DataPart = { type: 'append-message'; message: string };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type webSearchTool = InferUITool<ReturnType<typeof webSearch>>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type streamingDocumentTool = InferUITool<ReturnType<typeof createDocument>>; // streamingDocument uses same signature as createDocument

export type ChatTools = {
  webSearch: webSearchTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  streamingDocument: streamingDocumentTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  appendMessage: string;
  id: string;
  title: string;
  clear: null;
  finish: null;
  'force-save': null;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export interface Attachment {
  name: string;
  url: string;
  contentType: string;
}

export type ChatParts = UIMessagePart<CustomUIDataTypes, ChatTools>[];

export interface DbChatMessage {
  id: string;
  chatId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ChatParts;
  createdAt: string;
}