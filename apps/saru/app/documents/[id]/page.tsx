import { notFound } from 'next/navigation';
import { getUser } from '@/app/(auth)/auth';
import { getDocumentsById } from '@/lib/db/queries';
import { AlwaysVisibleArtifact } from '@/components/document/document-workspace';
import type { Document } from '@saru/db';

export const dynamic = 'auto';
export const dynamicParams = true;

export default async function DocumentPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const documentId = params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      console.warn(`[DocumentPage] Invalid document ID format: ${documentId}`);
      return notFound(); 
    }

    const user = await getUser();
    if (!user) {
      console.warn(`[DocumentPage] User not found. Redirecting.`);
      return notFound(); 
    }

    const documents: Document[] = await getDocumentsById({ ids: [documentId], userId: user.id });

    if (!documents || documents.length === 0) {
      console.log(`[DocumentPage] Document ${documentId} not found for user ${user.id}. Showing create prompt.`);
      return (
        <AlwaysVisibleArtifact 
          chatId="placeholder-for-artifact"
          initialDocumentId="init"
          initialDocuments={[]}
          showCreateDocumentForId={documentId}
          user={user}
        />
      );
    }
    
    return (
      <AlwaysVisibleArtifact 
        chatId="placeholder-for-artifact"
        initialDocumentId={documentId}
        initialDocuments={documents}
        user={user}
      />
    );

  } catch (error) {
    console.error(`[DocumentPage] Page error for document ${params.id}:`, error);
    return notFound();
  }
} 