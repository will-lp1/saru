import useSWR from 'swr';
import { useEffect } from 'react';
import { versionCache } from '@/lib/utils';
import type { Document } from '@snow-leopard/db';

/**
 * Hook to get and mutate the full version history for a document.
 * Uses SWR for revalidation while persisting the cache in IndexedDB
 * via the existing versionCache helper. The SWR key is
 * [`doc-versions`, userId, documentId].
 */
export function useDocumentVersions(documentId: string | null, userId?: string | null) {
  const key = documentId && userId ? ['doc-versions', userId, documentId] as const : null;

  const fetcher = async () => {
    if (!documentId) return [] as Document[];
    const res = await fetch(`/api/document?id=${encodeURIComponent(documentId)}&includeVersions=true`);
    if (!res.ok) throw new Error('Failed to fetch versions');
    const data = await res.json();
    if (userId) {
      await versionCache.setVersions(documentId, data, userId).catch(() => {});
    }
    return data as Document[];
  };

  const fallbackData = async () => {
    if (documentId && userId) {
      try {
        const cached = await versionCache.getVersions(documentId, userId);
        return cached ?? undefined;
      } catch {
      }
    }
    return undefined;
  };

  const swr = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 10000,
    suspense: false,
    fallbackData: undefined,
    keepPreviousData: true,
  });

  useEffect(() => {
    if (key) {
      swr.mutate(undefined, { revalidate: true });
    }
  }, [documentId, userId]);

  if (!swr.data && documentId && userId) {
    fallbackData().then((cached) => {
      if (cached) swr.mutate(cached, false);
    });
  }

  return {
    versions: swr.data ?? ([] as Document[]),
    isLoading: swr.isLoading,
    mutate: swr.mutate,
  } as const;
}
