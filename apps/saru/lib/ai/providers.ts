import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';

export const myProvider = customProvider({
  languageModels: {
    'chat-model-small': groq('llama-3.1-8b-instant'),
    'chat-model-large': groq('llama-3.3-70b-versatile'),
    'chat-model-reasoning': wrapLanguageModel({
      model: groq('openai/gpt-oss-120b'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': groq('openai/gpt-oss-20b'),
    'artifact-model': groq('meta-llama/llama-4-scout-17b-16e-instruct'),
  },
});
