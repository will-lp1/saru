import { Plugin, PluginKey, Transaction, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { buildContentFromDocument } from './functions';
import { versionCache } from '@/lib/utils'; 

export const savePluginKey = new PluginKey<SaveState>('save');

export type SaveStatus = 'idle' | 'debouncing' | 'saving' | 'error' | 'saved';

export interface SaveState {
  status: SaveStatus;
  lastSaved: Date | null;
  errorMessage: string | null;
  isDirty: boolean;
  createDocument?: boolean;
  initialContent?: string;
  triggerSave?: boolean;
}

interface SavePluginOptions {
  saveFunction: (content: string) => Promise<{ updatedAt: string | Date } | null>; 
  debounceMs?: number;
  initialLastSaved?: Date | null;
  documentId: string; 
  isCurrentVersion?: () => boolean;
}

export const INVALID_DOCUMENT_IDS = ["init", "undefined", "null"] as const;

export function isInvalidDocumentId(docId?: string | null): boolean {
  return !docId || INVALID_DOCUMENT_IDS.includes(docId as typeof INVALID_DOCUMENT_IDS[number]);
}

export function createSaveFunction(currentDocumentIdRef: React.MutableRefObject<string>) {
  return async (contentToSave: string): Promise<{ updatedAt: string | Date } | null> => {
    const docId = currentDocumentIdRef.current;
    if (isInvalidDocumentId(docId)) {
      console.warn("[Save Function] Attempted to save with invalid or init documentId:", docId);
      throw new Error("Cannot save with invalid or initial document ID.");
    }

    try {
      const response = await fetch(`/api/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docId,
          content: contentToSave,
          isDebouncedVersion: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown API error" }));
        console.error(`[Save Function] Save failed: ${response.status}`, errorData);
        throw new Error(`API Error: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return { updatedAt: result.updatedAt || new Date().toISOString() };
    } catch (error) {
      console.error(`[Save Function] Error during save for ${docId}:`, error);
      throw error;
    }
  };
}

export function savePlugin({
  saveFunction,
  debounceMs = 5000, 
  initialLastSaved = null,
  documentId,
  isCurrentVersion = () => true,
}: SavePluginOptions): Plugin<SaveState> {
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let inflightRequest: Promise<any> | null = null;
  let editorViewInstance: EditorView | null = null;
  let hasInitialized = false;
  const flushPendingSave = () => {
    if (!isCurrentVersion()) {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }
      return;
    }
    
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
      debounceTimeout = null;
    }
    if (editorViewInstance) {
      const content = buildContentFromDocument(editorViewInstance.state.doc);
      saveFunction(content)
        .then(() => {
          window.dispatchEvent(new CustomEvent('document-updated', { detail: { documentId } }));
        })
        .catch((e) => console.warn('[SavePlugin] Flush save failed', e));
    }
  };

  return new Plugin<SaveState>({
    key: savePluginKey,
    state: {
      init(_, state): SaveState {
        return {
          status: 'idle',
          lastSaved: initialLastSaved,
          errorMessage: null,
          isDirty: false,
          createDocument: false,
          initialContent: '',
        };
      },
      apply(tr, pluginState, oldState, newState): SaveState {
        const meta = tr.getMeta(savePluginKey);

        if (!hasInitialized) {
          hasInitialized = true;
          return pluginState;
        }
        
        if (tr.getMeta('external')) {
          return pluginState;
        }
        
        if (!isCurrentVersion()) {
          console.log('[SavePlugin] Skipping all save logic - viewing non-current version');
          return pluginState;
        }
        
        let shouldTriggerSave = false;
        if (meta) {
          if (meta.triggerSave === true) {
            shouldTriggerSave = true;
            meta.triggerSave = false; 
          }
          if (meta.createDocument === false) {
            return { ...pluginState, ...meta, initialContent: '' };
          }
          pluginState = { ...pluginState, ...meta };
        }

        if (!tr.docChanged && !shouldTriggerSave) {
          return pluginState;
        }

        if (shouldTriggerSave) {
          console.log('[SavePlugin] Explicit save triggered via meta.');
        }

        const wasEmpty = oldState.doc.content.size <= 2;
        if (documentId === 'init' && tr.docChanged && wasEmpty && newState.doc.textContent.trim().length > 0) {
          console.log('[SavePlugin] Initial input detected for "init" document. Triggering creation.');
          return {
            ...pluginState,
            status: 'idle',
            isDirty: false,
            createDocument: true,
            initialContent: newState.doc.textContent,
            errorMessage: null,
          };
        }
        
        if (debounceTimeout) {
          clearTimeout(debounceTimeout);
        }
        
        let newStatus: SaveStatus = 'debouncing';
        
        if (pluginState.status === 'saving' && inflightRequest) {
            console.log('[SavePlugin] Doc changed/triggered while saving, keeping saving status.');
            newStatus = 'saving';
        } else {
             pluginState = { ...pluginState, errorMessage: null };
        }

        const docActuallyChanged = tr.docChanged;

        debounceTimeout = setTimeout(() => {
          if (!editorViewInstance) {
              console.warn('[SavePlugin] Debounce fired, but editor view is not available.');
              return;
          }
          
          // Double-check we're still on current version when timeout fires
          if (!isCurrentVersion()) {
            console.log('[SavePlugin] Debounce fired but now viewing non-current version. Skipping save.');
            return;
          }
          
          const view = editorViewInstance;
          const currentState = savePluginKey.getState(view.state);
          
          if (!currentState || currentState.status !== 'debouncing') {
             console.log(`[SavePlugin] Debounce fired, but state is invalid or status is not debouncing (${currentState?.status}). Skipping save.`);
             return;
          }

          if (inflightRequest) {
            console.warn('[SavePlugin] Debounce fired, but another save is already in progress.');
            return; 
          }

          console.log('[SavePlugin] Debounce finished, triggering save.');
          
          setSaveStatus(view, { status: 'saving', isDirty: false });
          
          const contentToSave = buildContentFromDocument(view.state.doc);

          inflightRequest = saveFunction(contentToSave)
            .then(async result => {
              inflightRequest = null;
              console.log('[SavePlugin] Save successful.');
              try {
                await versionCache.invalidateVersions(documentId);
                console.log('[SavePlugin] Invalidated version cache after save');
                window.dispatchEvent(new CustomEvent('document-updated', { detail: { documentId } }));
              } catch(err){
                console.warn('[SavePlugin] Cache invalidation failed', err);
              }
              setSaveStatus(view, { 
                  status: 'saved',
                  lastSaved: result?.updatedAt ? new Date(result.updatedAt) : new Date(),
                  errorMessage: null,
                  isDirty: false
              });
            })
            .catch(error => {
               inflightRequest = null;
              console.error('[SavePlugin] Save failed:', error);
              setSaveStatus(view, { 
                  status: 'error',
                  errorMessage: error instanceof Error ? error.message : 'Unknown save error',
                  isDirty: true
              });
            });

        }, debounceMs);

        return {
          ...pluginState,
          status: newStatus,
          isDirty: pluginState.isDirty || docActuallyChanged,
        };
      },
    },
    view(editorView) {
       editorViewInstance = editorView;
       console.log(`[SavePlugin] View created for documentId: ${documentId}`);

       const handleVisibility = () => {
         if (document.hidden) flushPendingSave();
       };
       const handleBeforeUnload = () => flushPendingSave();

       document.addEventListener('visibilitychange', handleVisibility);
       window.addEventListener('beforeunload', handleBeforeUnload);

       return {
         destroy() {
           editorViewInstance = null;
           if (debounceTimeout) {
             clearTimeout(debounceTimeout);
           }
           document.removeEventListener('visibilitychange', handleVisibility);
           window.removeEventListener('beforeunload', handleBeforeUnload);
         }
       };
    }
  });
}

export function setSaveStatus(view: EditorView, statusUpdate: Partial<SaveState>) {
  const update = statusUpdate.createDocument === false 
                 ? { ...statusUpdate, initialContent: '' } 
                 : statusUpdate;
  view.dispatch(view.state.tr.setMeta(savePluginKey, update));
}

export function createForceSaveHandler(currentDocumentIdRef: React.MutableRefObject<string>) {
  return async (event: CustomEvent) => {
    const forceSaveDocId = event.detail.documentId;
    const currentEditorPropId = currentDocumentIdRef.current;

    if (forceSaveDocId !== currentEditorPropId || isInvalidDocumentId(currentEditorPropId)) {
      return;
    }

    try {
      const response = await fetch("/api/document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentEditorPropId,
          content: event.detail.content || "",
          isDebouncedVersion: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[Save Plugin] Force-save successful for ${currentEditorPropId}`);
      
      return {
        status: "saved" as const,
        lastSaved: new Date(data.updatedAt || new Date().toISOString()),
        isDirty: false,
      };
    } catch (error) {
      console.error(`[Save Plugin] Force-save failed for ${currentEditorPropId}:`, error);
      throw error;
    }
  };
}

/**
 * Creates a debounced version creation function
 * This will create a new version after 5 seconds of inactivity
 */
export function createDebouncedVersionHandler(currentDocumentIdRef: React.MutableRefObject<string>) {
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastContent = '';

  return async (content: string) => {
    const currentEditorPropId = currentDocumentIdRef.current;
    
    if (isInvalidDocumentId(currentEditorPropId)) {
      console.warn("[Debounced Version] Attempted to create version with invalid documentId:", currentEditorPropId);
      return;
    }

    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    if (content === lastContent) {
      return;
    }

    lastContent = content;

    debounceTimeout = setTimeout(async () => {
      try {
        console.log(`[Debounced Version] Creating new version for ${currentEditorPropId} after 5s inactivity`);
        
        const response = await fetch("/api/document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: currentEditorPropId,
            content: content,
            isDebouncedVersion: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Debounced Version] Successfully created new version for ${currentEditorPropId}`);
        
        try {
          await versionCache.invalidateVersions(currentEditorPropId);
          console.log(`[Debounced Version] Invalidated cache for ${currentEditorPropId}`);
        } catch (cacheError) {
          console.warn(`[Debounced Version] Failed to invalidate cache:`, cacheError);
        }
        
      } catch (error) {
        console.error(`[Debounced Version] Failed to create version for ${currentEditorPropId}:`, error);
      }
    }, 5000); 
  };
} 