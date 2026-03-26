import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';

export const myProvider = customProvider({
  languageModels: {
    'chat-model-small': groq('openai/gpt-oss-20b'),
    'chat-model-large': groq('openai/gpt-oss-120b'),
    'chat-model-reasoning': wrapLanguageModel({
      model: groq('deepseek-r1-distill-qwen-32b'),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    }),
    'title-model': groq('openai/gpt-oss-20b'),
    'artifact-model': groq('meta-llama/llama-4-scout-17b-16e-instruct'),
  },
});
