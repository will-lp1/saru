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
    name: 'Llama 4',
    description: 'Small and fast model',
  },
  {
    id: 'chat-model-large',
    name: 'Kimi K2',
    description: 'Large and powerful model',  },
  {
    id: 'chat-model-reasoning',
    name: 'GPT OSS',
    description: 'Advanced reasoning model',
  },
];
