import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

import type { WritingIssue, WritingIssueCategory } from '@/types/writing-feedback';
import { createIndexResolver } from './position-resolver';

const ALL_CATEGORIES: WritingIssueCategory[] = ['very-hard', 'hard', 'adverb', 'passive', 'weakener', 'simple-alt'];
export const feedbackPluginKey = new PluginKey('feedbackPlugin');

export function feedbackPlugin(documentId: string): Plugin {
  return new Plugin({
    key: feedbackPluginKey,
    view(editorView: EditorView) {
      const applyMarksToDocument = (issues: WritingIssue[], activeFilters: WritingIssueCategory[]) => {
        const { state } = editorView;
        const { tr } = state;
        const feedbackMarkType = state.schema.marks.feedbackMark;

        // Remove all existing feedback marks
        tr.removeMark(0, state.doc.content.size, feedbackMarkType);

        if (!issues.length) {
          editorView.dispatch(tr);
          return;
        }

        const resolver = createIndexResolver(state.doc);
        const allowedCategories = activeFilters.length ? new Set(activeFilters) : new Set(ALL_CATEGORIES);

        // Apply marks using resolved positions
        for (const issue of issues) {
          if (!allowedCategories.has(issue.category)) continue;

          const from = resolver.resolve(issue.start);
          const to = resolver.resolve(issue.end);

          if (from < to && to <= state.doc.content.size) {
            tr.addMark(
              from,
              to,
              feedbackMarkType.create({
                category: issue.category,
                severity: issue.severity,
                issueId: issue.id,
              })
            );
          }
        }

        editorView.dispatch(tr);
      };

      const handleHighlights = (event: CustomEvent) => {
        const detail = event.detail ?? {};
        if (detail.documentId !== documentId) return;

        const issues: WritingIssue[] = Array.isArray(detail.issues) ? detail.issues : [];
        const activeFilters: WritingIssueCategory[] = Array.isArray(detail.activeFilters)
          ? detail.activeFilters
          : ALL_CATEGORIES;

        applyMarksToDocument(issues, activeFilters);
      };

      const handleClearFeedback = () => {
        const { state } = editorView;
        const { tr } = state;
        const feedbackMarkType = state.schema.marks.feedbackMark;
        tr.removeMark(0, state.doc.content.size, feedbackMarkType);
        editorView.dispatch(tr);
      };

      const handleApplySuggestion = (event: CustomEvent) => {
        const detail = event.detail ?? {};
        if (detail.documentId !== documentId) return;
        const issue: WritingIssue | undefined = detail.issue;
        if (!issue) return;

        const { state } = editorView;
        const resolver = createIndexResolver(state.doc);
        const suggestion = issue.suggestion ?? '';

        // Convert plain text positions to ProseMirror positions
        const from = resolver.resolve(issue.start);
        const to = resolver.resolve(issue.end);

        if (from >= to || to > state.doc.content.size) {
          console.warn('[FeedbackPlugin] Invalid position range:', { issue, from, to, docSize: state.doc.content.size });
          return;
        }

        // Verify the text at this position matches what we expect
        const actualText = state.doc.textBetween(from, to);
        if (actualText !== issue.original) {
          console.warn('[FeedbackPlugin] Text mismatch:', {
            expected: issue.original,
            actual: actualText,
            range: { from, to }
          });
          return;
        }

        // Create the transaction to replace the text
        const tr = state.tr.replaceRangeWith(from, to, state.schema.text(suggestion));
        tr.setMeta('addToHistory', true);

        // Focus the editor and dispatch the transaction
        editorView.focus();
        editorView.dispatch(tr);

        console.log('[FeedbackPlugin] Applied suggestion:', {
          issueId: issue.id,
          original: issue.original,
          suggestion,
          range: { from, to },
          resolved: { from, to }
        });
      };

      window.addEventListener('feedback-highlights', handleHighlights as EventListener);
      window.addEventListener('feedback-clear', handleClearFeedback as EventListener);
      window.addEventListener('apply-feedback-suggestion', handleApplySuggestion as EventListener);

      return {
        destroy() {
          window.removeEventListener('feedback-highlights', handleHighlights as EventListener);
          window.removeEventListener('feedback-clear', handleClearFeedback as EventListener);
          window.removeEventListener('apply-feedback-suggestion', handleApplySuggestion as EventListener);
        },
      };
    },
  });
}