export const DEFAULT_CHAT_MODEL: string = 'chat-model-small';

interface ChatModel {
  id: string;
  name: string;
  description: string;
  proOnly?: boolean;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model-small',
    name: 'GPT OSS 120B',
    description: 'Recommended default model',
  },
  {
    id: 'chat-model-large',
    name: 'Kimi K2',
    description: 'Large and powerful model',
  },
  {
    id: 'chat-model-reasoning',
    name: 'GPT OSS 120B (Reasoning)',
    description: 'Advanced reasoning model',
  },
];
