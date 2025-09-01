import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';

export const synonymsPluginKey = new PluginKey<SynonymPluginState>('synonymsPlugin');

interface SynonymPluginState {
  decorationSet: DecorationSet;
  loadingPos: { from: number; to: number } | null;
}

function buildDecorations(doc: ProseMirrorNode, loadingPos: { from: number; to: number } | null): DecorationSet {
  const decorations: Decoration[] = [];
  const wordRegex = /\b\w+\b/g;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let match: RegExpExecArray | null;
    while ((match = wordRegex.exec(text)) !== null) {
      const start = pos + match.index;
      const end = start + match[0].length;
      const isLoading = loadingPos?.from === start && loadingPos?.to === end;
      decorations.push(
        Decoration.inline(start, end, {
          class: `synonym-word${isLoading ? ' synonym-loading' : ''}`,
          'data-word': match[0],
          'data-from': String(start),
          'data-to': String(end),
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

export function synonymsPlugin(): Plugin<SynonymPluginState> {
  let overlayContainer: HTMLDivElement | null = null;
  let currentFetchController: AbortController | null = null;
  let closeOverlayListener: ((event: MouseEvent) => void) | null = null;
  let overlayVisible = false;

  function dispatchLoadingState(view: EditorView, loadingPos: { from: number; to: number } | null) {
      view.dispatch(view.state.tr.setMeta(synonymsPluginKey, { loadingPos }));
  }

  function hideOverlay(view?: EditorView) {
    if (closeOverlayListener) {
        document.removeEventListener('mousedown', closeOverlayListener);
        closeOverlayListener = null;
    }
    if (overlayContainer) {
      overlayContainer.remove();
      overlayContainer = null;
    }
    // Notify React component to close overlay
    window.dispatchEvent(new CustomEvent('synonym-overlay:close'));
    overlayVisible = false;
    // If view is provided, ensure loading state is also cleared when hiding
    if (view && synonymsPluginKey.getState(view.state)?.loadingPos) {
        dispatchLoadingState(view, null);
    }
  }

  function showOverlay(target: HTMLElement, synonyms: string[], from: number, to: number, view: EditorView) {
    const rect = target.getBoundingClientRect();
    const event = new CustomEvent('synonym-overlay:open', {
      detail: {
        synonyms,
        position: { x: rect.left + rect.width / 2, y: rect.bottom + 1 },
        from,
        to,
        view,
      },
    });
    window.dispatchEvent(event);
    overlayVisible = true;
  }

  return new Plugin<SynonymPluginState>({
    key: synonymsPluginKey,
    state: {
      init(_, { doc }): SynonymPluginState {
        return { decorationSet: buildDecorations(doc, null), loadingPos: null };
      },
      apply(tr: Transaction, pluginState: SynonymPluginState, oldState: EditorState, newState: EditorState): SynonymPluginState {
        const meta = tr.getMeta(synonymsPluginKey);
        let nextLoadingPos = pluginState.loadingPos;

        if (meta !== undefined) {
          nextLoadingPos = meta.loadingPos;
        }

        if (tr.docChanged && nextLoadingPos) {
            nextLoadingPos = null; 
        }

        if (tr.docChanged || nextLoadingPos !== pluginState.loadingPos) {
          const nextDecorationSet = buildDecorations(newState.doc, nextLoadingPos);
          return { decorationSet: nextDecorationSet, loadingPos: nextLoadingPos };
        }

        if (nextLoadingPos === pluginState.loadingPos && pluginState.decorationSet === pluginState.decorationSet) {
             return pluginState;
        }

        return { ...pluginState, loadingPos: nextLoadingPos };
      },
    },
    props: {
      decorations(state: EditorState): DecorationSet | null {
        return this.getState(state)?.decorationSet ?? null;
      },
      handleDOMEvents: {
        mouseover(view, event) {
          const e = event as MouseEvent;
          if (!e.shiftKey) return false; 

          const target = (e.target as HTMLElement).closest('.synonym-word') as HTMLElement;
          if (!target) return false;

          const word = target.getAttribute('data-word');
          const from = Number(target.getAttribute('data-from'));
          const to = Number(target.getAttribute('data-to'));
          const currentState = synonymsPluginKey.getState(view.state);

          if (!word) return false;

          const resolvedPos = view.state.doc.resolve(from);
          const paragraphStart = resolvedPos.start();
          const paragraphEnd = resolvedPos.end();

          // Find current sentence boundaries
          let currentSentStart = from;
          while (currentSentStart > paragraphStart && !/[.!?]/.test(view.state.doc.textBetween(currentSentStart - 1, currentSentStart))) {
              currentSentStart--;
          }
          if (currentSentStart > paragraphStart + 1 && /[.!?]\s/.test(view.state.doc.textBetween(currentSentStart - 2, currentSentStart))) {
              // Keep it after the space if present
          } else if (currentSentStart > paragraphStart && /[.!?]/.test(view.state.doc.textBetween(currentSentStart - 1, currentSentStart))) {
             // Keep it right after punctuation if no space
          }

          let currentSentEnd = to;
          while (currentSentEnd < paragraphEnd && !/[.!?]/.test(view.state.doc.textBetween(currentSentEnd, currentSentEnd + 1))) {
              currentSentEnd++;
          }
          if (currentSentEnd < paragraphEnd) currentSentEnd++; // Include punctuation

          // Find previous sentence boundaries
          let prevSentStart = -1, prevSentEnd = -1;
          if (currentSentStart > paragraphStart) {
              prevSentEnd = currentSentStart;
              while(prevSentEnd > paragraphStart && /\s/.test(view.state.doc.textBetween(prevSentEnd - 1, prevSentEnd))) {
                  prevSentEnd--; // Skip whitespace before current sentence
              }
              prevSentStart = prevSentEnd;
               while (prevSentStart > paragraphStart && !/[.!?]/.test(view.state.doc.textBetween(prevSentStart - 1, prevSentStart))) {
                  prevSentStart--;
              }
          }

          // Find next sentence boundaries
          let nextSentStart = -1, nextSentEnd = -1;
          if (currentSentEnd < paragraphEnd) {
              nextSentStart = currentSentEnd;
               while(nextSentStart < paragraphEnd && /\s/.test(view.state.doc.textBetween(nextSentStart, nextSentStart + 1))) {
                  nextSentStart++; // Skip whitespace after current sentence
              }
              nextSentEnd = nextSentStart;
              while (nextSentEnd < paragraphEnd && !/[.!?]/.test(view.state.doc.textBetween(nextSentEnd, nextSentEnd + 1))) {
                  nextSentEnd++;
              }
              if (nextSentEnd < paragraphEnd) nextSentEnd++; // Include punctuation
          }

          // Extract sentences safely
          const getSafeText = (start: number, end: number): string => {
              if (start === -1 || end === -1 || start >= end || start < paragraphStart || end > paragraphEnd) return '';
              try {
                  return view.state.doc.textBetween(start, end, ' ');
              } catch { return ''; } // Safeguard against invalid ranges
          }

          const prevSentText = getSafeText(prevSentStart, prevSentEnd);
          const currSentText = getSafeText(currentSentStart, currentSentEnd);
          const nextSentText = getSafeText(nextSentStart, nextSentEnd);

          const context = [prevSentText, currSentText, nextSentText].map(s => s.trim()).filter(Boolean).join(' ');

          // Don't re-fetch if already loading this exact word
          if (currentState?.loadingPos?.from === from && currentState.loadingPos.to === to) {
            return false;
          }

          currentFetchController?.abort();
          const controller = new AbortController();
          currentFetchController = controller;

          dispatchLoadingState(view, { from, to });
          hideOverlay(); 

          fetch(`/api/synonyms`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({ word, context })
          })
            .then(res => {
              if (!res.ok) throw new Error(`API Error ${res.status}`);
              return res.json();
            })
            .then(data => {
              const latestState = synonymsPluginKey.getState(view.state);
              if (latestState?.loadingPos?.from === from && latestState.loadingPos.to === to) {
                  if (data.synonyms?.length > 0) {
                      showOverlay(target, data.synonyms, from, to, view);
                  } else {
                      dispatchLoadingState(view, null); 
                  }
              }
            })
            .catch(err => {
              if (err.name !== 'AbortError') {
                  const latestState = synonymsPluginKey.getState(view.state);
                  if (latestState?.loadingPos?.from === from && latestState.loadingPos.to === to) {
                    dispatchLoadingState(view, null);
                  }
              }
            })
            .finally(() => {
              if (currentFetchController === controller) {
                 currentFetchController = null;
              }
            });
          return true; 
        },
        mouseout(view, event) {
          const e = event as MouseEvent;
          if (!e.shiftKey && !overlayVisible) {
            hideOverlay(view);
            currentFetchController?.abort();
            currentFetchController = null;
          }
          return false;
        },
          keydown(view, event) {
            if (event.key === "Escape") {
                let handled = false;
                if (overlayContainer) {
                    hideOverlay(view);
                    currentFetchController?.abort();
                    currentFetchController = null;
                    handled = true;
                } else if (synonymsPluginKey.getState(view.state)?.loadingPos) {
                    currentFetchController?.abort();
                    currentFetchController = null;
                    dispatchLoadingState(view, null);
                    handled = true;
                }
                return handled;
            }
            return false;
          }
      }
    }
  });
} 