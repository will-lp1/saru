import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers';
import { generateUUID } from '@/lib/utils';
import { getAllDocumentVersions, saveDocument } from '@/lib/db/queries';

interface ForkBody {
  originalDocumentId: string;
  forkFromTimestamp?: string | Date;
  versionIndex?: number;
  newTitle?: string;
}

export async function forkDocument(request: NextRequest, body: any): Promise<NextResponse> {
  try {
    const { originalDocumentId, forkFromTimestamp, versionIndex, newTitle } = body as ForkBody;

    const readonlyHeaders = await headers();
    const session = await auth.api.getSession({ headers: new Headers(readonlyHeaders) });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!originalDocumentId || (forkFromTimestamp === undefined && versionIndex === undefined)) {
      return NextResponse.json({ error: 'Missing fork selector (timestamp or versionIndex)' }, { status: 400 });
    }
    
    const allVersions = await getAllDocumentVersions({ 
      documentId: originalDocumentId, 
      userId: session.user.id 
    });
    
    if (!allVersions.length) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    let targetVersion;

    if (typeof versionIndex === 'number') {
      targetVersion = allVersions[versionIndex];
    } else if (forkFromTimestamp) {
      targetVersion = allVersions.find(v => {
        const timeDiff = Math.abs(new Date(v.createdAt).getTime() - new Date(forkFromTimestamp).getTime());
        return timeDiff < 1000;
      });
    }
    
    if (!targetVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }
    
    const newDocumentId = generateUUID();
    const forkedDocument = await saveDocument({
      id: newDocumentId,
      title: newTitle || `${targetVersion.title} (Fork)`,
      content: targetVersion.content,
      userId: session.user.id,
      chatId: null
    });
    
    return NextResponse.json({ 
      forkedDocument,
      newDocumentId
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fork document'
    }, { status: 500 });
  }
}