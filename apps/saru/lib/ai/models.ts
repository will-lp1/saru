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
    name: 'Small Model',
    description: 'Fast and efficient for everyday tasks',
  },
  {
    id: 'chat-model-large',
    name: 'Large Model',
    description: 'Powerful model for complex tasks',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Reasoning Model',
    description: 'Advanced step-by-step reasoning',
  },
];
