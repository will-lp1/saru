import { Plugin, EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';

export function placeholderPlugin(text: string) {
  const placeholderClass = 'is-placeholder-empty';
  return new Plugin({
    props: {
      decorations(state: EditorState): DecorationSet | null {
        const { doc } = state;
        const decorations: Decoration[] = [];

        if (doc.childCount === 1) {
          const firstChild = doc.firstChild;
          if (
            firstChild?.isTextblock &&
            firstChild.content.size === 0
          ) {
            decorations.push(
              Decoration.node(0, firstChild.nodeSize, {
                class: placeholderClass,
                'data-placeholder': text,
              })
            );
          }
        }

        return DecorationSet.create(doc, decorations);
      },
    },
    view(editorView: EditorView) {
      const style = document.createElement('style');
      style.setAttribute('data-placeholder-style', 'true');
      style.textContent = `
        /* Ensure the placeholder node is positioned relative for its ::before */
        .ProseMirror .${placeholderClass} {
          position: relative;
        }
        /* Render placeholder text when editor is empty */
        .ProseMirror .${placeholderClass}::before {
          content: attr(data-placeholder);
          position: absolute;
          left: 0;
          top: 0;
          color: #adb5bd;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
          pointer-events: none;
          user-select: none;
          white-space: pre-wrap;
        }
      `;
      document.head.appendChild(style);
      return {
        destroy() {
          document.head.removeChild(style);
        },
      };
    },
  });
} 