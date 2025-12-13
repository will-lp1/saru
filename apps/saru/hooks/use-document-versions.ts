import { useEffect, useState, useCallback, useRef } from 'react';
import { versionCache } from '@/lib/utils';
import type { Document } from '@saru/db';

/**
 * Hook to get and mutate the full version history for a document.
 * Performs manual fetch + revalidation and persists the cache in IndexedDB
 * via the existing versionCache helper. Exposes a SWR-like API (mutate/refresh)
 * but does not depend on SWR.
 */
export function useDocumentVersions(documentId: string | null, userId?: string | null) {
  const [versions, setVersions] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);

  /**
   */
  const fetchVersions = useCallback(async () => {
    if (!documentId) return [] as Document[];
    setIsLoading(true);
    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(
        `/api/document?id=${encodeURIComponent(documentId)}&includeVersions=true`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error('Failed to fetch versions');
      const data = (await res.json()) as Document[];

      if (userId) {
        await versionCache.setVersions(documentId, data, userId).catch(() => {});
      }

      setVersions(data);
      return data;
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('[useDocumentVersions] fetch failed', err);
      }
      return versions;
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [documentId, userId]);

  /**
   * Attempt to load versions from the IndexedDB cache first.
   */
  const loadFromCache = useCallback(async () => {
    if (!documentId || !userId) return;
    try {
      const cached = await versionCache.getVersions<Document>(documentId, userId);
      if (cached) setVersions(cached);
    } catch {
      /* ignore cache errors */
    }
  }, [documentId, userId]);

  // initial load
  useEffect(() => {
    loadFromCache();
    fetchVersions();
    return () => abortRef.current?.abort();
  }, [loadFromCache, fetchVersions]);

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
        if (documentId && userId) {
          await versionCache.setVersions(documentId, data, userId).catch(() => {});
        }
      }

      if (options?.revalidate) {
        await fetchVersions();
      }
    },
    [fetchVersions, documentId, userId]
  );

  return {
    versions,
    isLoading,
    mutate,
    refresh: fetchVersions,
  } as const;
}






