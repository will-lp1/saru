import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { useAiOptions } from "@/hooks/ai-options";

export interface InlineSuggestionState {
  suggestionText: string | null;
  suggestionPos: number | null;
  isLoading: boolean;
}

export const inlineSuggestionPluginKey = new PluginKey<InlineSuggestionState>('inlineSuggestion');

const initialState: InlineSuggestionState = {
  suggestionText: null,
  suggestionPos: null,
  isLoading: false,
};

export const START_SUGGESTION_LOADING = 'startSuggestionLoading';
export const SET_SUGGESTION = 'setSuggestion';
export const CLEAR_SUGGESTION = 'clearSuggestion';
export const FINISH_SUGGESTION_LOADING = 'finishSuggestionLoading';

export function createInlineSuggestionCallback(documentId: string) {
  return async (state: EditorState, abortControllerRef: React.MutableRefObject<AbortController | null>, editorRef: React.MutableRefObject<EditorView | null>) => {
    const editor = editorRef.current;
    if (!editor) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const { selection } = state;
      const { head } = selection;

      const CONTEXT_WINDOW = 5000;

      const beforeFrom = Math.max(0, head - CONTEXT_WINDOW);
      const contextBefore = state.doc.textBetween(beforeFrom, head, "\n", "\n");

      const afterTo = Math.min(state.doc.content.size, head + CONTEXT_WINDOW);
      const contextAfter = state.doc.textBetween(head, afterTo, "\n", "\n");
      const fullContent = state.doc.textContent;

      const trailingNewlinesBefore = (contextBefore.match(/\n+$/)?.[0].length) ?? 0;
      const leadingNewlinesAfter = (contextAfter.match(/^\n+/)?.[0].length) ?? 0;
      const prevChar = state.doc.textBetween(Math.max(0, head - 1), head);
      const nextChar = state.doc.textBetween(head, Math.min(state.doc.content.size, head + 1));

      const {
        suggestionLength,
        customInstructions,
        writingStyleSummary,
        applyStyle,
      } = useAiOptions.getState();

      const response = await fetch("/api/inline-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          contextBefore,
          contextAfter,
          fullContent,
          nodeType: "paragraph",
          structureInfo: {
            trailingNewlinesBefore,
            leadingNewlinesAfter,
            prevChar,
            nextChar,
          },
          aiOptions: {
            suggestionLength,
            customInstructions,
            writingStyleSummary,
            applyStyle,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedSuggestion = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || controller.signal.aborted) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(5));
              if (data.type === "suggestion-delta") {
                accumulatedSuggestion += data.content;
                if (editorRef.current) {
                  editorRef.current.dispatch(
                    editorRef.current.state.tr.setMeta(SET_SUGGESTION, {
                      text: accumulatedSuggestion,
                    })
                  );
                }
              } else if (data.type === "error") {
                throw new Error(data.content);
              } else if (data.type === "finish") {
                break;
              }
            } catch (err) {
              console.warn("Error parsing SSE line:", line, err);
            }
          }
        }
      }
      
      if (!controller.signal.aborted && editorRef.current) {
        editorRef.current.dispatch(
          editorRef.current.state.tr.setMeta(FINISH_SUGGESTION_LOADING, true)
        );
      } else if (controller.signal.aborted) {
        if (editorRef.current) {
          editorRef.current.dispatch(
            editorRef.current.state.tr.setMeta(CLEAR_SUGGESTION, true)
          );
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Error fetching inline suggestion:", error);
        if (editorRef.current) {
          editorRef.current.dispatch(
            editorRef.current.state.tr.setMeta(CLEAR_SUGGESTION, true)
          );
        }
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };
}

export function inlineSuggestionPlugin(options: { requestSuggestion?: (state: EditorState) => void }): Plugin<InlineSuggestionState> {
  return new Plugin<InlineSuggestionState>({
    key: inlineSuggestionPluginKey,
    state: {
      init(): InlineSuggestionState {
        return initialState;
      },
      apply(tr: Transaction, pluginState: InlineSuggestionState, _oldState: EditorState, newState: EditorState): InlineSuggestionState {
        const metaStart = tr.getMeta(START_SUGGESTION_LOADING);
        const metaSet = tr.getMeta(SET_SUGGESTION);
        const metaClear = tr.getMeta(CLEAR_SUGGESTION);
        const metaFinish = tr.getMeta(FINISH_SUGGESTION_LOADING);

        if (metaStart) {
          const pos = newState.selection.head;
          return { suggestionText: null, isLoading: true, suggestionPos: pos };
        }

        if (metaSet) {
          const { text } = metaSet as { text: string };
          if (pluginState.isLoading && pluginState.suggestionPos === newState.selection.head) {
            return { ...pluginState, suggestionText: text };
          }
          return pluginState;
        }

        if (metaFinish) {
          if (pluginState.isLoading && pluginState.suggestionPos !== null) {
            return { ...pluginState, isLoading: false };
          }
          return initialState;
        }

        if (metaClear) {
          return initialState;
        }

        if (pluginState.suggestionPos !== null && (pluginState.isLoading || pluginState.suggestionText)) {
          if (tr.docChanged || !newState.selection.empty || newState.selection.head !== pluginState.suggestionPos) {
            return initialState;
          }
        }

        return pluginState;
      },
    },
    props: {
      decorations(state: EditorState): DecorationSet | null {
        const pluginState = inlineSuggestionPluginKey.getState(state);
        if (!pluginState || pluginState.suggestionPos === null) {
          return null;
        }

        const { isLoading, suggestionText, suggestionPos } = pluginState;

        if (isLoading && !suggestionText) {
          const decoration = Decoration.widget(
            suggestionPos,
            () => {
              const el = document.createElement('span');
              el.className = 'inline-suggestion-loader';
              return el;
            },
            { side: 1 }
          );
          return DecorationSet.create(state.doc, [decoration]);
        }

        if (suggestionText) {
          const decoration = Decoration.widget(
            suggestionPos,
            () => {
              const wrapper = document.createElement('span');
              wrapper.className = 'inline-suggestion-wrapper';

              const suggestionSpan = document.createElement('span');
              suggestionSpan.className = 'suggestion-decoration-inline';
              const raw = suggestionText!;
              const trimmed = raw.trimStart();
              const first = trimmed.charAt(0);
              const isAlphaNum = /^[A-Za-z0-9]/.test(first);
              const prevChar = suggestionPos > 0
                ? state.doc.textBetween(suggestionPos - 1, suggestionPos)
                : '';
              const needsSpace = isAlphaNum && prevChar && !/\s/.test(prevChar);
              const displayText = needsSpace ? ' ' + trimmed : trimmed;
              suggestionSpan.setAttribute('data-suggestion', displayText);
              wrapper.appendChild(suggestionSpan);

              const kbd = document.createElement('kbd');
              kbd.className = 'inline-tab-icon';
              kbd.style.marginLeft = '0.25em';
              kbd.textContent = 'Tab';
              wrapper.appendChild(kbd);

              return wrapper;
            },
            { side: 1 }
          );
          return DecorationSet.create(state.doc, [decoration]);
        }

        return null;
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const pluginState = inlineSuggestionPluginKey.getState(view.state);
        if (!pluginState) return false;

        if (event.key === 'Tab' && !event.shiftKey) {
          if (pluginState.suggestionText && pluginState.suggestionPos !== null) {
            event.preventDefault();
            const raw = pluginState.suggestionText!;
            const trimmed = raw.trimStart();
            const first = trimmed.charAt(0);
            const isAlphaNum = /^[A-Za-z0-9]/.test(first);
            const prev = pluginState.suggestionPos! > 0
              ? view.state.doc.textBetween(pluginState.suggestionPos! - 1, pluginState.suggestionPos!)
              : '';
            const needsSpace = isAlphaNum && prev && !/\s/.test(prev);
            const text = needsSpace ? ' ' + trimmed : trimmed;
            let tr = view.state.tr.insertText(text, pluginState.suggestionPos!);
            tr = tr.setMeta(CLEAR_SUGGESTION, true);
            tr = tr.scrollIntoView();
            view.dispatch(tr);
            return true;
          }
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(START_SUGGESTION_LOADING, true));
          options.requestSuggestion?.(view.state);
          return true;
        }

        if (event.key === 'Escape' && (pluginState.suggestionText || pluginState.isLoading)) {
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(CLEAR_SUGGESTION, true));
          return true;
        }

        return false;
      },
    },
  });
} 