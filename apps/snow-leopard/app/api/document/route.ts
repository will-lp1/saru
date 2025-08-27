import { NextRequest, NextResponse } from 'next/server';
import { createDocument } from './actions/create';
import { updateDocument } from './actions/update';
import { deleteDocument } from './actions/delete';
import { getDocuments } from './actions/get';
import { renameDocument } from './actions/rename';
import { forkDocument } from './actions/fork';

export async function GET(request: NextRequest) {
  return getDocuments(request);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  return createDocument(request, body);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const recognisedAction = (body.action ?? '').toLowerCase();

  if (recognisedAction === 'fork') {
    return forkDocument(request, body);
  }
  if (recognisedAction === 'rename') {
    return renameDocument(request, body);
  }
  if (recognisedAction === 'update') {
    return updateDocument(request, body);
  }

  if (body.originalDocumentId && (body.versionIndex !== undefined || body.forkFromTimestamp)) {
    return forkDocument(request, body);
  }

  if (body.id && typeof body.title === 'string' && !('content' in body)) {
    return renameDocument(request, body);
  }

  return updateDocument(request, body);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  return deleteDocument(request, body);
}