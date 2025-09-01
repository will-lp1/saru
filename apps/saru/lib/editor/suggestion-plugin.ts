import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { EditorView, Decoration, DecorationSet } from 'prosemirror-view';

export interface SelectionContextState {
  isActive: boolean;
  isLoading: boolean;
  from: number | null;
  to: number | null;
}

export const selectionContextPluginKey = new PluginKey<SelectionContextState>('selectionContext');

const initialState: SelectionContextState = {
  isActive: false,
  isLoading: false,
  from: null,
  to: null,
};

export const ACTIVATE_SUGGESTION_CONTEXT = 'activateSuggestionContext';
export const DEACTIVATE_SUGGESTION_CONTEXT = 'deactivateSuggestionContext';
export const SET_SUGGESTION_LOADING_STATE = 'setSuggestionLoadingState';

export function selectionContextPlugin(documentId: string): Plugin<SelectionContextState> {
  return new Plugin<SelectionContextState>({
    key: selectionContextPluginKey,
    state: {
      init(): SelectionContextState {
        return initialState;
      },
      apply(tr: Transaction, pluginState: SelectionContextState, _oldState: EditorState, newState: EditorState): SelectionContextState {
        const activateMeta = tr.getMeta(ACTIVATE_SUGGESTION_CONTEXT);
        if (activateMeta) {
          const { from, to } = activateMeta as { from: number; to: number };
          if (newState.selection.from >= from && newState.selection.to <= to) {
            return { ...initialState, isActive: true, from, to };
          }
          return initialState;
        }

        const deactivateMeta = tr.getMeta(DEACTIVATE_SUGGESTION_CONTEXT);
        if (deactivateMeta) {
          return initialState;
        }

        const loadingMeta = tr.getMeta(SET_SUGGESTION_LOADING_STATE);
        if (loadingMeta !== undefined && pluginState.isActive) {
          return { ...pluginState, isLoading: !!loadingMeta };
        }

        if (pluginState.isActive && pluginState.from !== null && pluginState.to !== null) {
          if (tr.docChanged) {
            try {
              const newFrom = tr.mapping.map(pluginState.from);
              const newTo = tr.mapping.map(pluginState.to);
              if (newFrom === newTo) return initialState;
            } catch (e) {
              return initialState;
            }
          }
        }

        return pluginState;
      },
    },
    props: {
      decorations(state: EditorState): DecorationSet | null {
        const pluginState = selectionContextPluginKey.getState(state);
        if (!pluginState?.isActive || pluginState.from === null || pluginState.to === null) {
          return null;
        }

        const decorationClass = pluginState.isLoading
          ? 'suggestion-context-loading'
          : 'suggestion-context-highlight';

        const maxPos = state.doc.content.size;
        const from = Math.min(pluginState.from, maxPos);
        const to = Math.min(pluginState.to, maxPos);
        
        if (from >= to) return null;

        const decoration = Decoration.inline(
          from,
          to,
          { class: decorationClass },
          { inclusiveStart: false, inclusiveEnd: false }
        );
        return DecorationSet.create(state.doc, [decoration]);
      },
    },
    view(editorView: EditorView) {
      const handleApplySuggestion = (event: CustomEvent) => {
        if (!event.detail) return;
        const { state, dispatch } = editorView;

        const {
          from,
          to,
          suggestion,
          documentId: suggestionDocId,
        } = event.detail;

        if (suggestionDocId !== documentId) {
          console.warn(
            `[Selection Context Plugin] Event ignored: Document ID mismatch. Expected ${documentId}, got ${suggestionDocId}.`
          );
          return;
        }

        if (
          typeof from !== "number" ||
          typeof to !== "number" ||
          from < 0 ||
          to > state.doc.content.size ||
          from > to
        ) {
          console.error(
            `[Selection Context Plugin] Invalid range received: [${from}, ${to}]. Document size: ${state.doc.content.size}`
          );
          return;
        }

        console.log(
          `[Selection Context Plugin] Applying suggestion "${suggestion}" at range [${from}, ${to}]`
        );

        try {
          const transaction = state.tr.replaceWith(
            from,
            to,
            state.schema.text(suggestion)
          );
          dispatch(transaction);
        } catch (error) {
          console.error(
            `[Selection Context Plugin] Error applying transaction:`,
            error
          );
        }
      };

      window.addEventListener("apply-suggestion", handleApplySuggestion as EventListener);

      return {
        destroy() {
          window.removeEventListener("apply-suggestion", handleApplySuggestion as EventListener);
        },
      };
    },
  });
}