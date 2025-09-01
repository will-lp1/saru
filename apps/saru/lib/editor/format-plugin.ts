import { Plugin, PluginKey, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { documentSchema } from './config';

const { nodes, marks } = documentSchema;

export interface FormatState {
  h1: boolean;
  h2: boolean;
  p: boolean;
  bulletList: boolean;
  orderedList: boolean;
  bold: boolean;
  italic: boolean;
}

export const formatPluginKey = new PluginKey<FormatState>('format');

function isMarkActive(state: EditorState, type: any): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) {
    return !!type.isInSet(state.storedMarks || $from.marks());
  } else {
    return state.doc.rangeHasMark(from, to, type);
  }
}

function isBlockActive(state: EditorState, type: any, attrs: Record<string, any> = {}): boolean {
  const { $from } = state.selection;
  const node = $from.node($from.depth);
  return node?.hasMarkup(type, attrs);
}

function isListActive(state: EditorState, type: any): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === type) {
      return true;
    }
  }
  return false;
}

function getActiveFormats(state: EditorState): FormatState {
  return {
    h1: isBlockActive(state, nodes.heading, { level: 1 }),
    h2: isBlockActive(state, nodes.heading, { level: 2 }),
    p: isBlockActive(state, nodes.paragraph),
    bulletList: isListActive(state, nodes.bullet_list),
    orderedList: isListActive(state, nodes.ordered_list),
    bold: isMarkActive(state, marks.strong),
    italic: isMarkActive(state, marks.em),
  };
}

export function formatPlugin(onFormatChange: (formats: FormatState) => void): Plugin<FormatState> {
  return new Plugin<FormatState>({
    key: formatPluginKey,
    state: {
      init(_, state): FormatState {
        return getActiveFormats(state);
      },
      apply(tr, pluginState, oldState, newState): FormatState {
        if (tr.selectionSet || tr.docChanged) {
          return getActiveFormats(newState);
        }
        return pluginState;
      },
    },
    view(editorView: EditorView) {
      const initialState = formatPluginKey.getState(editorView.state);
      if (initialState) {
        onFormatChange(initialState);
      }
      
      return {
        update(view: EditorView, prevState: EditorState) {
          const newState = formatPluginKey.getState(view.state);
          const oldState = formatPluginKey.getState(prevState);
          
          if (newState && oldState && newState !== oldState) {
            onFormatChange(newState);
          }
        },
      };
    },
  });
}