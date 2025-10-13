import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { buildContentFromDocument, buildDocumentFromContent } from './functions';

export const creationStreamingKey = new PluginKey('creationStreaming');

/**
 * A ProseMirror plugin that listens for creation stream events and
 * inserts incoming Markdown chunks into the document as structured nodes.
 *
 * Usage:
 *   window.dispatchEvent(new CustomEvent('editor:stream-text', { detail: { documentId, content } }));
 */
export function creationStreamingPlugin(targetDocumentId: string) {
  return new Plugin({
    key: creationStreamingKey,
    view(editorView) {
      let pendingMarkdown = '';
      let accumulatedMarkdown = buildContentFromDocument(editorView.state.doc) ?? '';
      let rafId: number | null = null;

      const flush = () => {
        rafId = null;
        const chunk = pendingMarkdown;
        if (!chunk) return;
        pendingMarkdown = '';

        const nextMarkdown = accumulatedMarkdown + chunk;
        try {
          const docNode = buildDocumentFromContent(nextMarkdown);
          const fragment = docNode.content;
          const { state, dispatch } = editorView;
          const tr = state.tr
            .replaceWith(0, state.doc.content.size, fragment)
            .setMeta('external', true)
            .setMeta('addToHistory', false);

          const endPos = tr.doc.content.size;
          tr.setSelection(TextSelection.create(tr.doc, endPos));
          dispatch(tr);
          accumulatedMarkdown = nextMarkdown;
        } catch (err) {
          console.error('[CreationStreamingPlugin] Failed to flush stream fragment:', err);
          pendingMarkdown = chunk + pendingMarkdown;
          scheduleFlush();
        }
      };

      const scheduleFlush = () => {
        if (rafId != null) return;
        rafId = requestAnimationFrame(flush);
      };

      const queueMarkdown = (markdown: string) => {
        if (!markdown) return;
        pendingMarkdown += markdown;
        scheduleFlush();
      };

      const handleStream = (event: CustomEvent) => {
        const { documentId, content } = (event as any).detail || {};
        if (documentId !== targetDocumentId) return;
        queueMarkdown(typeof content === 'string' ? content : '');
      };

      const handleArtifact = (event: CustomEvent) => {
        const { documentId, name, delta } = event.detail ?? {};
        if (documentId !== targetDocumentId) return;
        if (name !== 'markdown') return;
        queueMarkdown(typeof delta === 'string' ? delta : '');
      };
      window.addEventListener('editor:stream-text', handleStream as EventListener);
      window.addEventListener('editor:stream-artifact', handleArtifact as EventListener);
      return {
        destroy() {
          window.removeEventListener('editor:stream-text', handleStream as EventListener);
          window.removeEventListener('editor:stream-artifact', handleArtifact as EventListener);
          if (rafId != null) cancelAnimationFrame(rafId);
        },
      };
    },
  });
} 
