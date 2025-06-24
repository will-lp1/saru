import { Plugin, PluginKey, EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

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

export function inlineSuggestionPlugin(options: { requestSuggestion: (state: EditorState, view: EditorView) => void }): Plugin<InlineSuggestionState> {
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
        if (!pluginState?.suggestionText || pluginState.suggestionPos === null) {
          return null;
        }
        const decoration = Decoration.widget(
          pluginState.suggestionPos,
          () => {
            const wrapper = document.createElement('span');
            wrapper.className = 'inline-suggestion-wrapper';

            const suggestionSpan = document.createElement('span');
            suggestionSpan.className = 'suggestion-decoration-inline';
            suggestionSpan.setAttribute('data-suggestion', pluginState.suggestionText || '');
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
      },
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        const pluginState = inlineSuggestionPluginKey.getState(view.state);
        if (!pluginState) return false;

        if (event.key === 'Tab' && !event.shiftKey) {
          if (pluginState.suggestionText && pluginState.suggestionPos !== null) {
            event.preventDefault();
            let text = pluginState.suggestionText;
            if (pluginState.suggestionPos > 0) {
              const prevChar = view.state.doc.textBetween(
                pluginState.suggestionPos - 1,
                pluginState.suggestionPos
              );
              if (/\w|[\.\?!,;:]/.test(prevChar) && !text.startsWith(' ')) {
                text = ' ' + text;
              }
            }
            let tr = view.state.tr.insertText(text, pluginState.suggestionPos);
            tr = tr.setMeta(CLEAR_SUGGESTION, true);
            tr = tr.scrollIntoView();
            view.dispatch(tr);
            return true;
          }
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(START_SUGGESTION_LOADING, true));
          options.requestSuggestion(view.state, view);
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