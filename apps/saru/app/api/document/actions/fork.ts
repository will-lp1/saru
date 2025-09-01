import { NextRequest, NextResponse } from 'next/server';
import { auth } from "@/lib/auth";
import { headers } from 'next/headers';
import { generateUUID } from '@/lib/utils';
import { getAllDocumentVersions } from '@/lib/db/queries';
import { db } from '@saru/db';
import * as schema from '@saru/db';

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

    const forkTime = new Date(
      typeof forkFromTimestamp === 'string' ? forkFromTimestamp : targetVersion.createdAt
    ).getTime();

    const versionsUpToFork = allVersions.filter(v => new Date(v.createdAt).getTime() <= forkTime);

    const forkedDoc = await db.transaction(async (tx) => {
      const now = new Date();

      const [doc] = await tx.insert(schema.Document).values({
        id: newDocumentId,
        title: newTitle || `${targetVersion.title} (Fork)`,
        content: targetVersion.content,
        userId: session.user.id,
        chatId: null,
        is_current: true,
        createdAt: now,
        updatedAt: now,
      }).returning();

      for (let i = 0; i < versionsUpToFork.length; i++) {
        const v = versionsUpToFork[i];
        await tx.insert(schema.DocumentVersion).values({
          documentId: newDocumentId,
          content: v.content,
          version: i + 1,
          previousVersionId: null,
          createdAt: new Date(v.createdAt),
          updatedAt: new Date(v.updatedAt),
        });
      }

      return doc;
    });

    return NextResponse.json({ forkedDocument: forkedDoc, newDocumentId });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to fork document'
    }, { status: 500 });
  }
}