import OrderedMap from 'orderedmap';
import {
  Schema,
  type Node as ProsemirrorNode,
  type MarkSpec,
  DOMParser,
} from 'prosemirror-model';
import { schema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef, useMemo } from 'react';
import { renderToString } from 'react-dom/server';
import { Markdown } from '@/components/markdown';

import { diffEditor, DiffType } from '@/lib/editor/diff';

const diffSchema = new Schema({
  nodes: addListNodes(schema.spec.nodes, 'paragraph block*', 'block'),
  marks: OrderedMap.from({
    ...schema.spec.marks.toObject(),
    diffMark: {
      attrs: { type: { default: '' } },
      toDOM(mark) {
        let className = '';

        switch (mark.attrs.type) {
          case DiffType.Inserted:
            className =
              'bg-green-100 text-green-700 dark:bg-green-500/70 dark:text-green-300';
            break;
          case DiffType.Deleted:
            className =
              'bg-red-100 line-through text-red-600 dark:bg-red-500/70 dark:text-red-300';
            break;
          default:
            className = '';
        }
        return ['span', { class: className }, 0];
      },
    } as MarkSpec,
  }),
});

type DiffEditorProps = {
  oldContent: string;
  newContent: string;
};

export const DiffView = ({ oldContent, newContent }: DiffEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  // Memoize expensive computations
  const diffedDoc = useMemo(() => {
    if (!oldContent && !newContent) return null;
    
    try {
      const parser = DOMParser.fromSchema(diffSchema);

      const oldHtmlContent = renderToString(
        <Markdown>{oldContent}</Markdown>,
      );
      const newHtmlContent = renderToString(
        <Markdown>{newContent}</Markdown>,
      );

      const oldContainer = document.createElement('div');
      oldContainer.innerHTML = oldHtmlContent;

      const newContainer = document.createElement('div');
      newContainer.innerHTML = newHtmlContent;

      const oldDoc = parser.parse(oldContainer);
      const newDoc = parser.parse(newContainer);

      return diffEditor(diffSchema, oldDoc.toJSON(), newDoc.toJSON());
    } catch (error) {
      console.error('Failed to compute diff:', error);
      return null;
    }
  }, [oldContent, newContent]);

  useEffect(() => {
    if (!editorRef.current || !diffedDoc) return;

    // Create editor only once or when diffedDoc changes
    if (viewRef.current) {
      // Update existing editor instead of recreating
      const tr = viewRef.current.state.tr.replaceWith(
        0, 
        viewRef.current.state.doc.content.size, 
        diffedDoc.content
      );
      viewRef.current.dispatch(tr);
    } else {
      // Create new editor only if none exists
      const state = EditorState.create({
        doc: diffedDoc,
        plugins: [],
      });

      viewRef.current = new EditorView(editorRef.current, {
        state,
        editable: () => false,
      });
    }

    // Cleanup only on unmount
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [diffedDoc]); // Only depend on the memoized diffedDoc

  if (!diffedDoc) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No changes to display
      </div>
    );
  }

  return <div className="diff-editor" ref={editorRef} />;
};