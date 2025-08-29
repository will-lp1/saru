import { exampleSetup } from 'prosemirror-example-setup';
import { inputRules } from 'prosemirror-inputrules';
import { Plugin } from 'prosemirror-state';

import { documentSchema, headingRule } from './config';
import { creationStreamingPlugin } from './creation-streaming-plugin';
import { placeholderPlugin } from './placeholder-plugin';
import { inlineSuggestionPlugin } from './inline-suggestion-plugin';
import { selectionContextPlugin } from './suggestion-plugin';
import { synonymsPlugin } from './synonym-plugin';
import { diffPlugin } from './diff-plugin';
import { formatPlugin } from './format-plugin';
import { savePlugin } from './save-plugin';
import { emojiPlugin } from './emoji-plugin';

export interface EditorPluginOptions {
  documentId: string;
  initialLastSaved: Date | null;
  placeholder?: string;
  performSave: (content: string) => Promise<any>;
  requestInlineSuggestion: (state: any) => void;
  setActiveFormats: (formats: any) => void;
  isCurrentVersion?: () => boolean;
}

export function createEditorPlugins(opts: EditorPluginOptions): Plugin[] {
  return [
    creationStreamingPlugin(opts.documentId),
    placeholderPlugin(opts.placeholder ?? (opts.documentId === 'init' ? 'Start typing' : 'Start typing...')),
    ...exampleSetup({ schema: documentSchema, menuBar: false }),
    inputRules({
      rules: [1, 2, 3, 4, 5, 6].map((level) => headingRule(level)),
    }),
    inlineSuggestionPlugin({ requestSuggestion: opts.requestInlineSuggestion }),
    selectionContextPlugin(opts.documentId),
    synonymsPlugin(),
    diffPlugin(opts.documentId),
    formatPlugin(opts.setActiveFormats),
    emojiPlugin(),
    savePlugin({
      saveFunction: opts.performSave,
      initialLastSaved: opts.initialLastSaved,
      debounceMs: 5000, 
      documentId: opts.documentId,
    }),
  ];
} 