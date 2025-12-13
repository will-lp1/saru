import { NextResponse } from 'next/server';
import { auth } from "@/lib/auth"; 
import { headers } from 'next/headers';
import { getDocumentsById, getChatsByUserId } from '@/lib/db/queries';

export async function GET() {
  // --- Authentication --- 
  const readonlyHeaders = await headers();
  const requestHeaders = new Headers(readonlyHeaders);
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 1. Fetch recent chats using Drizzle query
    // Note: getChatsByUserId fetches all chats, add limit/pagination if needed later
    const chats = await getChatsByUserId({ id: userId }); 
    // If you need to limit, the query itself would need modification or slicing here:
    // const recentChats = chats.slice(0, 10); // Example slicing

    // 2. Collect all unique document IDs from the contexts (same logic)
    const docIds = new Set<string>();
    chats.forEach(chat => {
      // Ensure context is treated as potentially null/undefined before access
      const context = chat.document_context as unknown;
      if (!context || typeof context !== 'object') return;

      const active = (context as Record<string, unknown>).active;
      if (typeof active === 'string' && uuidRegex.test(active)) {
        docIds.add(active);
      }

      const mentioned = (context as Record<string, unknown>).mentioned;
      if (Array.isArray(mentioned)) {
        for (const id of mentioned) {
          if (typeof id === 'string' && uuidRegex.test(id)) {
            docIds.add(id);
          }
        }
      }
    });

    // 3. Fetch titles for these documents (using existing Drizzle getDocumentsById)
    const uniqueDocIds = Array.from(docIds);
    let documentTitles: { [id: string]: string } = {};
    if (uniqueDocIds.length > 0) {
      try {
        // getDocumentsById already uses Drizzle and checks userId
        const documents = await getDocumentsById({ ids: uniqueDocIds, userId: userId });
        documents.forEach(doc => {
          if (doc) { // Ensure document is not null/undefined
             documentTitles[doc.id] = doc.title;
          }
        });
      } catch (docError) {
        console.error('Error fetching document titles for history:', docError);
        // Proceed without titles if fetching fails (same logic)
      }
    }

    // 4. Process chats, adding titles to the context (same logic)
    const processedChats = chats.map(chat => {
      const rawContext = chat.document_context as unknown;
      const context =
        rawContext && typeof rawContext === 'object'
          ? (rawContext as Record<string, unknown>)
          : {};

      const active =
        typeof context.active === 'string' && uuidRegex.test(context.active)
          ? context.active
          : null;

      const mentioned =
        Array.isArray(context.mentioned)
          ? context.mentioned.filter((id): id is string => typeof id === 'string' && uuidRegex.test(id))
          : [];

      return {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        userId: chat.userId,
        document_context: {
          active,
          activeTitle: active ? (documentTitles[active] || null) : null,
          mentioned,
          mentionedTitles: mentioned.map((id) => documentTitles[id] || null),
        }
      };
    });

    return NextResponse.json(processedChats);

  } catch (error) {
    console.error('Error processing history request:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
