import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers';
import { getMessagesByChatId, getChatById, getMessageById, updateToolMetadata } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      console.error('Session error in /api/messages');
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
    }

    const chat = await getChatById({ id: chatId });
    if (!chat) {
       return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (chat.userId !== userId) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const readonlyHeaders = await headers();
    const requestHeaders = new Headers(readonlyHeaders);
    const session = await auth.api.getSession({ headers: requestHeaders });

    if (!session?.user?.id) {
      console.error('Session error in PATCH /api/messages');
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json();
    const { messageId, chatId, toolCallId, applied, rejected } = body;

    if (!messageId || !chatId || !toolCallId) {
      return NextResponse.json(
        { error: 'messageId, chatId, and toolCallId are required' },
        { status: 400 }
      );
    }

    // Verify the chat belongs to the user
    const chat = await getChatById({ id: chatId });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (chat.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify the message exists and belongs to the chat
    const message = await getMessageById({ id: messageId });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    if (message.chatId !== chatId) {
      return NextResponse.json({ error: 'Message does not belong to this chat' }, { status: 403 });
    }

    // Update the tool metadata
    await updateToolMetadata({ messageId, toolCallId, applied, rejected });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Error updating message' }, { status: 500 });
  }
}