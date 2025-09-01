'use server';

import { generateText, Message } from 'ai';
import { redirect } from 'next/navigation';

import {
  getDocumentById,
  getLatestDocumentByUserId,
  saveDocument,
} from '@/lib/db/queries';
import { myProvider } from '@/lib/ai/providers';
import { getSession, getUser } from '../(auth)/auth';
import { generateUUID } from '@/lib/utils';
export async function generateDocumentTitleFromContent({
  content,
}: {
  content: string;
}) {
  const { text: title } = await generateText({
    model: myProvider.languageModel('title-model'),
    system: `\n
    - you will generate a short title based on the content of a document
    - ensure it is not more than 80 characters long
    - the title should be a summary of the document content
    - do not use quotes or colons`,
    prompt: content,
  });

  return title;
}

export async function updateDocumentContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  // First get the existing document to preserve other fields
  const document = await getDocumentById({ id });
  
  // Handle case where document is not found
  if (!document) {
    console.error(`[Action] updateDocumentContent: Document with ID ${id} not found.`);
    // Optionally throw an error or handle differently
    throw new Error(`Document not found: ${id}`); 
  }
  
  // Now document is guaranteed to be non-null
  await saveDocument({
    id: document.id, // Use document.id for consistency
    title: document.title,
    kind: null,
    content,
    userId: document.userId,
    // saveDocument creates a new version, is_current defaults to true
  });
} 

export async function createNewDocument() {
  const session = await getSession();
  if (!session?.user?.id) { 
    redirect('/'); 
  }

  const user = await getUser();
  if (!user) {
    redirect('/');
  }

  const latestDocument = await getLatestDocumentByUserId({ userId: user.id });

  if (latestDocument) {
    const trimmedContent = (latestDocument.content || '').trim();

    if (
      latestDocument.title === "Untitled Document" &&
      trimmedContent === ''
    ) {
      console.log(`[Documents] Reusing existing untitled document ${latestDocument.id}`);
      redirect(`/documents/${latestDocument.id}`);
    }
  }
  const newDocumentId = generateUUID();

  try {
    await saveDocument({
      id: newDocumentId,
      title: 'Untitled Document',
      content: '',
      kind: 'text',
      userId: user.id,
    });

    console.log(`[Documents Page] Created document ${newDocumentId} for user ${user.id}`);
  } catch (error) {
    console.error('[Documents Page] Failed to create document:', error);
  }

  redirect(`/documents/${newDocumentId}`);
}