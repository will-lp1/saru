'use server';

import { generateText, UIMessage } from 'ai';
import { cookies } from 'next/headers';

import {
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
} from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/providers';

function fallbackTitleFromMessage(message: UIMessage): string {
  const parts = message.parts ?? [];
  const text = parts
    .filter(
      (p): p is { type: 'text'; text: string } =>
        typeof p === 'object' &&
        p !== null &&
        'type' in p &&
        (p as { type?: unknown }).type === 'text' &&
        'text' in p &&
        typeof (p as { text?: unknown }).text === 'string'
    )
    .map((p) => p.text)
    .join('')
    .trim();

  const base = text.length ? text : 'New chat';
  return base.length > 80 ? base.slice(0, 77) + '…' : base;
}

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  try {
    const { text: title } = await generateText({
      model: myProvider.languageModel('title-model'),
      system: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
      prompt: JSON.stringify(message),
    });

    const trimmed = title.trim();
    return trimmed.length ? trimmed : fallbackTitleFromMessage(message);
  } catch (error) {
    console.warn('[Chat Actions] generateTitleFromUserMessage failed, using fallback:', error);
    return fallbackTitleFromMessage(message);
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  try {
    const message = await getMessageById({ id });

    if (message) {
      await deleteMessagesByChatIdAfterTimestamp({
        chatId: message.chatId,
        timestamp: message.createdAt,
      });
    } else {
      console.warn(
        '[Chat Actions] deleteTrailingMessages: message not found, skipping delete',
        { id }
      );
    }
  } catch (error) {
    console.warn('Failed to delete trailing messages by ID, skipping:', error);
  }
}
