import { useEffect, useState, useCallback } from 'react';
import { versionCache } from '@/lib/utils';
import type { Document } from '@snow-leopard/db';

/**
 * Hook to get and mutate the full version history for a document.
 * Uses SWR for revalidation while persisting the cache in IndexedDB
 * via the existing versionCache helper. The SWR key is
 * [`doc-versions`, userId, documentId].
 */
export function useDocumentVersions(documentId: string | null, userId?: string | null) {
  const [versions, setVersions] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   */
  const fetchVersions = useCallback(async () => {
    if (!documentId) return [] as Document[];
    setIsLoading(true);
    try {
      const res = await fetch(`/api/document?id=${encodeURIComponent(documentId)}&includeVersions=true`);
      if (!res.ok) throw new Error('Failed to fetch versions');
      const data = (await res.json()) as Document[];

      if (userId) {
        await versionCache.setVersions(documentId, data, userId).catch(() => {});
      }

      setVersions(data);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, [documentId, userId]);

  /**
   * Attempt to load versions from the IndexedDB cache first.
   */
  const loadFromCache = useCallback(async () => {
    if (!documentId || !userId) return;
    try {
      const cached = await versionCache.getVersions(documentId, userId);
      if (cached) setVersions(cached);
    } catch {
      /* ignore cache errors */
    }
  }, [documentId, userId]);

  // initial load
  useEffect(() => {
    loadFromCache();
    fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, userId]);

  /**
   * A mutate helper that mirrors the SWR API we previously used so the rest of
   * the codebase remains unchanged. If `data` is provided we update state
   * immediately. If `options?.revalidate` is `true` we trigger a refetch.
   */
  const mutate = useCallback(
    async (
      data?: Document[] | undefined,
      options?: { revalidate?: boolean }
    ) => {
      if (data) {
        setVersions(data);
      }

      if (options?.revalidate) {
        await fetchVersions();
      }
    },
    [fetchVersions]
  );

  return {
    versions,
    isLoading,
    mutate,
    refresh: fetchVersions,
  } as const;
}






