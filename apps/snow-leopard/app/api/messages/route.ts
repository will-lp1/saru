import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers';
import { getMessagesByChatId, getChatById } from '@/lib/db/queries';
import { getGT } from 'gt-next/server';

export async function GET(request: Request) {
  try {
    const t = await getGT();
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      console.error('Session error in /api/messages');
      return NextResponse.json({ error: t('Authentication error') }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: t('Chat ID is required') }, { status: 400 });
    }

    const chat = await getChatById({ id: chatId });
    if (!chat) {
       return NextResponse.json({ error: t('Chat not found') }, { status: 404 });
    }
    if (chat.userId !== userId) {
       return NextResponse.json({ error: t('Unauthorized') }, { status: 403 });
    }

    const messages = await getMessagesByChatId({ id: chatId });

    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt
    }));

    return NextResponse.json(formattedMessages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    const t = await getGT();
    return NextResponse.json({ error: t('Error fetching messages') }, { status: 500 });
  }
} 