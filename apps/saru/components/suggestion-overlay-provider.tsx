'use client';

import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import SuggestionOverlay from './suggestion-overlay';
import { useDocument } from '@/hooks/use-document';
import { toast } from 'sonner';
import { getActiveEditorView } from '@/lib/editor/editor-state';
import {
  ACTIVATE_SUGGESTION_CONTEXT,  
  DEACTIVATE_SUGGESTION_CONTEXT,
  SET_SUGGESTION_LOADING_STATE
} from '@/lib/editor/suggestion-plugin';

interface SuggestionOverlayContextType {
  openSuggestionOverlay: (options: {
    position?: { x: number; y: number };
    selectedText?: string;
    from?: number;
    to?: number;
  }) => void;
  closeSuggestionOverlay: () => void;
  setSuggestionIsLoading: (isLoading: boolean) => void;
}

const SuggestionOverlayContext = createContext<SuggestionOverlayContextType | null>(null);

export function SuggestionOverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const { document } = useDocument();
  const documentId = document.documentId;

  const setSuggestionIsLoading = useCallback((isLoading: boolean) => {
    const view = getActiveEditorView();
    if (view) {
      const tr = view.state.tr.setMeta(SET_SUGGESTION_LOADING_STATE, isLoading);
      view.dispatch(tr);
    }
  }, []);

  const openSuggestionOverlay = useCallback(
    ({
      selectedText,
      position,
      from,
      to,
    }: {
      selectedText?: string;
      position?: { x: number; y: number };
      from?: number;
      to?: number;
    }) => {
      if (selectedText) {
        setSelectedText(selectedText);
      } else {
        setSelectedText('');
      }

      if (typeof from === 'number' && typeof to === 'number') {
        setSelectionRange({ from, to });
        const view = getActiveEditorView();
        if (view) {
          // Ensure any previous active state is cleared first, then activate new.
          // This handles rapidly opening new overlays without explicit close.
          let tr = view.state.tr.setMeta(DEACTIVATE_SUGGESTION_CONTEXT, true);
          tr = tr.setMeta(ACTIVATE_SUGGESTION_CONTEXT, { from, to });
          view.dispatch(tr);
        }
      } else {
        setSelectionRange(null);
        // If opening without a specific range, ensure any existing highlight is cleared.
        const view = getActiveEditorView();
        if (view) {
            const tr = view.state.tr.setMeta(DEACTIVATE_SUGGESTION_CONTEXT, true);
            view.dispatch(tr);
        }
      }

      if (position) {
        setPosition(position);
      } else {
        setPosition({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 3 });
      }

      setIsOpen(true);
    },
    [] // No dependencies, relies on getActiveEditorView at call time
  );

  const closeSuggestionOverlay = useCallback(() => {
    setIsOpen(false);
    setSelectedText('');
    setSelectionRange(null);
    
    const view = getActiveEditorView();
    if (view) {
      // Ensure loading is set to false and then deactivate
      let tr = view.state.tr.setMeta(SET_SUGGESTION_LOADING_STATE, false);
      tr = tr.setMeta(DEACTIVATE_SUGGESTION_CONTEXT, true);
      view.dispatch(tr);
    }
  }, []); // No dependencies, relies on getActiveEditorView at call time

  const handleAcceptSuggestion = useCallback((suggestion: string) => {
    if (!documentId || documentId === 'init') {
      toast.error("Cannot apply suggestion: No document loaded.");
      return;
    }

    if (selectedText && selectedText.trim() !== '' && selectionRange) {
      console.log(`[Provider] Dispatching apply-suggestion event for range [${selectionRange.from}, ${selectionRange.to}]`);
      const event = new CustomEvent('apply-suggestion', {
        detail: {
          from: selectionRange.from,
          to: selectionRange.to,
          suggestion: suggestion,
          documentId: documentId,
          originalText: selectedText,
        }
      });
      window.dispatchEvent(event);
      closeSuggestionOverlay(); // This will also handle deactivating plugin state
    } else {
      if (!selectionRange) {
        toast.warning("Cannot apply suggestion: Text range not captured.");
      } else {
        toast.warning("Cannot apply suggestion: No text was selected.");
      }
    }
  }, [documentId, selectedText, selectionRange, closeSuggestionOverlay]);

  // Setup global keyboard shortcut for cmd+k
  useEffect(() => {
    const handleCommandK = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();

        const activeEditorView = getActiveEditorView();

        if (activeEditorView && activeEditorView.state) {
          const { state } = activeEditorView;
          const { from, to, empty } = state.selection;

          if (!empty) {
            const text = state.doc.textBetween(from, to, ' \\n\\n ');
            
            let pos = { x: 100, y: 100 }; // Default position
            const domSelection = window.getSelection();
            const range = domSelection?.getRangeAt(0);

            if (range) {
              const rect = range.getBoundingClientRect();
              const overlayWidth = 400; // Approximate width of SuggestionOverlay
              const overlayHeight = 450; // Approximate max height of SuggestionOverlay
              const padding = 10; // Viewport padding

              let newX = rect.left;
              let newY = rect.bottom + padding;

              // Adjust X if it goes off-screen right
              if (newX + overlayWidth > window.innerWidth - padding) {
                newX = window.innerWidth - overlayWidth - padding;
              }
              // Adjust X if it goes off-screen left (less common for LTR text selection)
              if (newX < padding) {
                newX = padding;
              }

              // Adjust Y if it goes off-screen bottom
              if (newY + overlayHeight > window.innerHeight - padding) {
                // Try to position above the selection
                newY = rect.top - overlayHeight - padding;
              }
              // Adjust Y if (after trying above) it goes off-screen top
              if (newY < padding) {
                newY = padding; // Fallback to top of screen with padding
              }
              
              pos = { x: newX, y: newY };
            }

            console.log(`[Provider] Opening overlay via Cmd+K from editor state. Range: [${from}, ${to}]`);
            openSuggestionOverlay({
              position: pos,
              selectedText: text,
              from,
              to,
            });
          } else {
            toast.info("Select text in the editor before pressing Cmd+K.");
          }
        } else {
          console.warn('[Provider] Cmd+K pressed, but no active editor view found.');
          toast.error("Cannot open suggestion overlay: Editor not active.");
        }
      }
    };

    window.addEventListener('keydown', handleCommandK);
    return () => window.removeEventListener('keydown', handleCommandK);
  }, [openSuggestionOverlay]);

  return (
    <SuggestionOverlayContext.Provider
      value={{
        openSuggestionOverlay,
        closeSuggestionOverlay,
        setSuggestionIsLoading,
      }}
    >
      {children}
      {documentId && documentId !== 'init' && (
        <SuggestionOverlay
          documentId={documentId}
          isOpen={isOpen}
          onClose={closeSuggestionOverlay}
          selectedText={selectedText}
          position={position}
          onAcceptSuggestion={handleAcceptSuggestion}
          // highlightedTextProps is no longer needed as the plugin handles highlighting
        />
      )}
    </SuggestionOverlayContext.Provider>
  );
}

export function useSuggestionOverlay() {
  const context = useContext(SuggestionOverlayContext);
  
  if (!context) {
    throw new Error('useSuggestionOverlay must be used within a SuggestionOverlayProvider');
  }
  
  return context;
} 