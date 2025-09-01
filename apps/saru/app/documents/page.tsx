import { redirect } from 'next/navigation';
import { getSession, getUser } from '@/app/(auth)/auth';
import { AlwaysVisibleArtifact } from '@/components/document/document-workspace';

export default async function Page() {
  const session = await getSession();

  if (!session?.user?.id) { 
    redirect('/'); 
  }

  const user = await getUser();
  if (!user) {
    redirect('/');
  }

  return (
    <AlwaysVisibleArtifact 
      chatId="new-chat"
      initialDocumentId="init"
      initialDocuments={[]} 
      user={user}
    />
  );
} 