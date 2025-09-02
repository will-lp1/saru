import { Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { buildContentFromDocument, buildDocumentFromContent } from './functions';
import { diffEditor } from './diff';
import { documentSchema } from './config';

export const diffPluginKey = new PluginKey('diff');

export function diffPlugin(documentId: string): Plugin {
  let previewOriginalContentRef: string | null = null;
  let previewActiveRef: boolean = false;
  let lastPreviewContentRef: string | null = null;

  return new Plugin({
    key: diffPluginKey,
    view(editorView: EditorView) {
      const handlePreviewUpdate = (event: CustomEvent) => {
        if (!event.detail) return;
        const { documentId: previewDocId, newContent } = event.detail;
        if (previewDocId !== documentId) return;

        if (lastPreviewContentRef === newContent) return;

        if (!previewActiveRef) {
          previewOriginalContentRef = buildContentFromDocument(editorView.state.doc);
          // Commented out: editorView.dom.setAttribute('contenteditable', 'false');
          // Let the Editor component handle editability
        }

        const oldContent = previewOriginalContentRef ?? buildContentFromDocument(editorView.state.doc);
        if (newContent === oldContent) return;

        const oldDocNode = buildDocumentFromContent(oldContent);
        const newDocNode = buildDocumentFromContent(newContent);

        const diffedDoc = diffEditor(documentSchema, oldDocNode.toJSON(), newDocNode.toJSON());

        const tr = editorView.state.tr
          .replaceWith(0, editorView.state.doc.content.size, diffedDoc.content)
          .setMeta('external', true)
          .setMeta('addToHistory', false);

        try {
          requestAnimationFrame(() => editorView.dispatch(tr));
        } catch (err) {
        }

        previewActiveRef = true;
        lastPreviewContentRef = newContent;
      };

      const handleCancelPreview = (event: CustomEvent) => {
        if (!event.detail) return;
        const { documentId: cancelDocId } = event.detail;
        if (cancelDocId !== documentId) return;
        if (!previewActiveRef || previewOriginalContentRef === null) return;

        const originalDocNode = buildDocumentFromContent(previewOriginalContentRef);
        const tr = editorView.state.tr
          .replaceWith(0, editorView.state.doc.content.size, originalDocNode.content)
          .setMeta('external', true)
          .setMeta('addToHistory', false);
        editorView.dispatch(tr);

        previewActiveRef = false;
        previewOriginalContentRef = null;
        lastPreviewContentRef = null;
        // Commented out: editorView.dom.setAttribute('contenteditable', 'true');
        // Let the Editor component handle editability
      };

      const handleApply = (event: CustomEvent) => {
        if (!event.detail) return;
        const { documentId: applyDocId } = event.detail;
        if (applyDocId !== documentId) return;

        const animationDuration = 500;

        const finalizeApply = async () => {
          const { state } = editorView;
          let tr = state.tr;
          const diffMarkType = state.schema.marks.diffMark;
          const { DiffType } = await import('./diff');

          const rangesToDelete: { from: number; to: number }[] = [];
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;

            const deletedMark = node.marks.find(
              (mark) => mark.type === diffMarkType && mark.attrs.type === DiffType.Deleted
            );
            if (deletedMark) {
              rangesToDelete.push({ from: pos, to: pos + node.nodeSize });
            }
          });

          for (let i = rangesToDelete.length - 1; i >= 0; i--) {
            const { from, to } = rangesToDelete[i];
            tr.delete(from, to);
          }
          
          tr.removeMark(0, tr.doc.content.size, diffMarkType);
          tr.setMeta('addToHistory', false);
          editorView.dispatch(tr);
          editorView.dom.classList.remove('applying-changes');

          previewActiveRef = false;
          previewOriginalContentRef = null;
          lastPreviewContentRef = null;
        };

        editorView.dom.classList.add('applying-changes');
        setTimeout(finalizeApply, animationDuration);
        // Commented out: editorView.dom.setAttribute('contenteditable', 'true');
        // Let the Editor component handle editability
      };

      window.addEventListener('preview-document-update', handlePreviewUpdate as EventListener);
      window.addEventListener('cancel-document-update', handleCancelPreview as EventListener);
      window.addEventListener('apply-document-update', handleApply as EventListener);

      return {
        destroy() {
          window.removeEventListener('preview-document-update', handlePreviewUpdate as EventListener);
          window.removeEventListener('cancel-document-update', handleCancelPreview as EventListener);
          window.removeEventListener('apply-document-update', handleApply as EventListener);
        },
      };
    },
  });
}