import { Plugin, PluginKey } from 'prosemirror-state';
import { buildDocumentFromContent } from './functions';

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
      let rafId: number | null = null;

      const flush = () => {
        rafId = null;
        const chunk = pendingMarkdown;
        pendingMarkdown = '';
        if (!chunk) return;
        try {
          const docNode = buildDocumentFromContent(chunk);
          const fragment = docNode.content;
          const { state, dispatch } = editorView;
          const endPos = state.doc.content.size;
          const tr = state.tr.insert(endPos, fragment);
          dispatch(tr);
        } catch (err) {
          console.error('[CreationStreamingPlugin] Failed to flush stream fragment:', err);
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
        const { documentId, content } = event.detail;
        if (documentId !== targetDocumentId) return;
        queueMarkdown(content);
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
