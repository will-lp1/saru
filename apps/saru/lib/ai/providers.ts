import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { groq } from '@ai-sdk/groq';

export const myProvider = customProvider({
  languageModels: {
        'chat-model-small': groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
        'chat-model-large': groq('moonshotai/kimi-k2-instruct'),
        'chat-model-reasoning': wrapLanguageModel({
          model: groq('deepseek-r1-distill-llama-70b'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
    'title-model': groq('llama-3.1-8b-instant'),
    'artifact-model': groq('meta-llama/llama-4-maverick-17b-128e-instruct'),
  },
});
