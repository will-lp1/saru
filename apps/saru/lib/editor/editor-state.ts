import type { EditorView } from 'prosemirror-view';

// Simple module-level variable to hold the reference
let activeEditorViewInstance: EditorView | null = null;

/**
 * Sets the globally accessible active ProseMirror EditorView instance.
 * Should be called when an editor is created or focused.
 */
export function setActiveEditorView(view: EditorView | null): void {
  console.log('[EditorState] Setting active editor view:', view ? 'Instance' : 'null');
  activeEditorViewInstance = view;
}

/**
 * Gets the globally accessible active ProseMirror EditorView instance.
 * Returns null if no editor view is currently active.
 */
export function getActiveEditorView(): EditorView | null {
  return activeEditorViewInstance;
} 