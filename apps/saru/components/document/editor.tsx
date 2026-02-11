"use client";

import { EditorState, Transaction } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Fragment, Node as PMNode, Slice } from "prosemirror-model";
import React, { memo, useEffect, useRef, useCallback, useState } from "react";
import { buildContentFromDocument, buildDocumentFromContent } from "@/lib/editor/functions";
import { setActiveEditorView } from "@/lib/editor/editor-state";
import { EditorToolbar } from "@/components/document/editor-toolbar";
import {
  savePluginKey,
  setSaveStatus,
  createSaveFunction,
  createForceSaveHandler,
  createDebouncedVersionHandler,
  type SaveState,
} from "@/lib/editor/save-plugin";
import { createEditorPlugins } from "@/lib/editor/editor-plugins";
import { createInlineSuggestionCallback } from "@/lib/editor/inline-suggestion-plugin";
import { type FormatState } from "@/lib/editor/format-plugin";
import SynonymOverlay from "@/components/synonym-overlay";


type EditorProps = {
  content: string;
  status: "streaming" | "idle";
  isCurrentVersion: boolean | undefined;
  currentVersionIndex: number;
  documentId: string;
  initialLastSaved: Date | null;
  onStatusChange?: (status: SaveState) => void;
  onCreateDocumentRequest?: (initialContent: string) => void;
};

function normalizeInlineText(text: string): string {
  return text
    .replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\n+/g, " ");
}

function getLeadingChar(node: PMNode): string {
  if (node.isText) return node.text?.charAt(0) ?? "";

  let result = "";
  node.forEach((child) => {
    if (!result) result = getLeadingChar(child);
  });
  return result;
}

function getTrailingChar(node: PMNode): string {
  if (node.isText) return node.text?.slice(-1) ?? "";

  const children: PMNode[] = [];
  node.forEach((child) => children.push(child));
  for (let i = children.length - 1; i >= 0; i -= 1) {
    const result = getTrailingChar(children[i]);
    if (result) return result;
  }
  return "";
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

function normalizeFragmentContent(fragment: Fragment, inCodeBlock = false): Fragment {
  const originalChildren: PMNode[] = [];
  fragment.forEach((child) => originalChildren.push(child));

  const children = originalChildren.map((child) =>
    normalizeDocumentBreaks(child, inCodeBlock)
  );

  let changed = children.some((child, idx) => child !== originalChildren[idx]);

  if (!inCodeBlock) {
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child.type.name !== "hard_break") continue;

      const prevChar = i > 0 ? getTrailingChar(children[i - 1]) : "";
      const nextChar = i < children.length - 1 ? getLeadingChar(children[i + 1]) : "";

      if (isWordChar(prevChar) && isWordChar(nextChar)) {
        children[i] = child.type.schema.text(" ");
        changed = true;
      }
    }
  }

  return changed ? Fragment.fromArray(children) : fragment;
}

function normalizeDocumentBreaks(node: PMNode, inCodeBlock = false): PMNode {
  const insideCodeBlock = inCodeBlock || node.type.name === "code_block";

  if (node.isText && !insideCodeBlock && node.text) {
    const normalizedText = normalizeInlineText(node.text);
    if (normalizedText !== node.text) {
      return node.type.schema.text(normalizedText, node.marks);
    }
    return node;
  }

  if (node.isLeaf) return node;

  const normalizedContent = normalizeFragmentContent(node.content, insideCodeBlock);
  if (normalizedContent === node.content) return node;
  return node.copy(normalizedContent);
}

function normalizeSlice(slice: Slice): Slice {
  const normalizedContent = normalizeFragmentContent(slice.content, false);
  if (normalizedContent === slice.content) return slice;
  return new Slice(normalizedContent, slice.openStart, slice.openEnd);
}

function normalizePastedPlainText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, "")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/([^\n])\n([^\n])/g, "$1 $2");
}

function PureEditor({
  content,
  status,
  isCurrentVersion,
  currentVersionIndex,
  documentId,
  initialLastSaved,
  onStatusChange,
  onCreateDocumentRequest,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const currentDocumentIdRef = useRef(documentId);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [activeFormats, setActiveFormats] = useState<FormatState>({
    h1: false,
    h2: false,
    p: false,
    bulletList: false,
    orderedList: false,
    bold: false,
    italic: false,
  });

  const [synonymState, setSynonymState] = useState<{isOpen:boolean; synonyms:string[]; position:{x:number;y:number}; from:number; to:number; view: EditorView | null}>({isOpen:false,synonyms:[],position:{x:0,y:0},from:0,to:0,view:null});

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail as {synonyms:string[]; position:{x:number;y:number}; from:number; to:number; view:EditorView};
      setSynonymState({isOpen:true, synonyms:detail.synonyms, position:detail.position, from:detail.from, to:detail.to, view:detail.view});
    };
    const handleClose = () => setSynonymState(s => ({...s, isOpen:false}));
    window.addEventListener('synonym-overlay:open', handleOpen);
    window.addEventListener('synonym-overlay:close', handleClose);
    return () => {
      window.removeEventListener('synonym-overlay:open', handleOpen);
      window.removeEventListener('synonym-overlay:close', handleClose);
    };
  }, []);

  useEffect(() => {
    currentDocumentIdRef.current = documentId;
  }, [documentId]);

  const isCurrentVersionRef = useRef(isCurrentVersion);
  useEffect(() => {
    isCurrentVersionRef.current = isCurrentVersion;
    if (editorRef.current) {
      editorRef.current.setProps({ editable: () => !!isCurrentVersion });
    }
  }, [isCurrentVersion]);

  const performSave = useCallback(createSaveFunction(currentDocumentIdRef), []);
  const debouncedVersionHandler = useCallback(createDebouncedVersionHandler(currentDocumentIdRef), []);
  const requestInlineSuggestionCallback = useCallback(
    createInlineSuggestionCallback(documentId),
    [documentId]
  );

  useEffect(() => {
    let view: EditorView | null = null;
    if (containerRef.current && !editorRef.current) {
      const plugins = createEditorPlugins({
        documentId,
        initialLastSaved,
        performSave,
        requestInlineSuggestion: (state) =>
          requestInlineSuggestionCallback(state, abortControllerRef, editorRef),
        setActiveFormats,
        isCurrentVersion: () => !!isCurrentVersionRef.current,
      });

      const initialEditorState = EditorState.create({
        doc: normalizeDocumentBreaks(buildDocumentFromContent(content)),
        plugins: plugins,
      });

      view = new EditorView(containerRef.current, {
        state: initialEditorState,
        clipboardTextParser: (text, _context, _plain, view) => {
          const normalized = normalizePastedPlainText(text);
          const schema = view.state.schema;
          const paragraph = schema.nodes.paragraph;

          if (!paragraph) return Slice.empty;

          const blocks = normalized.split(/\n{2,}/).filter(Boolean);
          if (blocks.length === 0) return Slice.empty;

          const paragraphNodes = blocks.map((block) =>
            paragraph.create(
              null,
              block.length > 0 ? schema.text(block) : undefined
            )
          );

          return new Slice(Fragment.fromArray(paragraphNodes), 0, 0);
        },
        transformPasted: (slice) => normalizeSlice(slice),
        handleDOMEvents: {
          focus: (view) => {
            setActiveEditorView(view);
            return false;
          },
          blur: () => false,
        },
        dispatchTransaction: (transaction: Transaction) => {
          if (!editorRef.current) return;
          const editorView = editorRef.current;

          const oldEditorState = editorView.state;
          const oldSaveState = savePluginKey.getState(oldEditorState);
          let newState = editorView.state.apply(transaction);

          const normalizedDoc = normalizeDocumentBreaks(newState.doc);
          if (!normalizedDoc.eq(newState.doc)) {
            const normalizeTr = newState.tr.replaceWith(
              0,
              newState.doc.content.size,
              normalizedDoc.content
            );
            normalizeTr.setMeta("addToHistory", false);
            newState = newState.apply(normalizeTr);
          }

          editorView.updateState(newState);

          const newSaveState = savePluginKey.getState(newState);
          if (onStatusChange && newSaveState && newSaveState !== oldSaveState) {
            onStatusChange(newSaveState);
          }

          // Handle debounced version creation when content changes (only for current version)
          if (transaction.docChanged && isCurrentVersion) {
            const currentContent = buildContentFromDocument(newState.doc);
            debouncedVersionHandler(currentContent);
          }

          if (
            newSaveState?.createDocument &&
            newSaveState.initialContent &&
            onCreateDocumentRequest
          ) {
            onCreateDocumentRequest(newSaveState.initialContent);
            setTimeout(() => {
              if (editorView) {
                setSaveStatus(editorView, { createDocument: false });
              }
            }, 0);
          }
        },
      });

      editorRef.current = view;
      setActiveEditorView(view);

      const initialSaveState = savePluginKey.getState(view.state);
      if (onStatusChange && initialSaveState) {
        onStatusChange(initialSaveState);
      }
    } else if (editorRef.current) {
      const currentView = editorRef.current;

      if (documentId !== currentDocumentIdRef.current) {
        const newPlugins = createEditorPlugins({
          documentId,
          initialLastSaved,
          performSave,
          requestInlineSuggestion: (state) =>
            requestInlineSuggestionCallback(state, abortControllerRef, editorRef),
          setActiveFormats,
          isCurrentVersion: () => !!isCurrentVersionRef.current,
        });

        const newDoc = normalizeDocumentBreaks(buildDocumentFromContent(content));
        const newState = EditorState.create({
          doc: newDoc,
          plugins: newPlugins,
        });
        currentView.updateState(newState);
      } else {
        const currentContent = buildContentFromDocument(currentView.state.doc);
        if (content !== currentContent) {
          const saveState = savePluginKey.getState(currentView.state);
          if (saveState?.isDirty) {
            console.warn("[Editor] External content update received, but editor is dirty. Ignoring update.");
          } else {
            const newDocument = normalizeDocumentBreaks(buildDocumentFromContent(content));
            const transaction = currentView.state.tr.replaceWith(
              0,
              currentView.state.doc.content.size,
              newDocument.content
            );
            transaction.setMeta("external", true);
            transaction.setMeta("addToHistory", false);
            currentView.dispatch(transaction);
          }
        }
      }

      currentView.setProps({
        editable: () => !!isCurrentVersion,
      });
    }

    return () => {
      if (view) {
        view.destroy();
        if (editorRef.current === view) {
          editorRef.current = null;
        }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [
    content,
    documentId,
    initialLastSaved,
    isCurrentVersion,
    performSave,
    onStatusChange,
    onCreateDocumentRequest,
    requestInlineSuggestionCallback,
  ]);
  
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.dom.setAttribute(
        "contenteditable",
        isCurrentVersion ? "true" : "false"
      );
    }
  }, [isCurrentVersion]);

  useEffect(() => {
    const handleCreationStreamFinished = (event: CustomEvent) => {
      const finishedDocId = event.detail.documentId;
      const editorView = editorRef.current;
      const currentEditorPropId = documentId;

      if (
        editorView &&
        finishedDocId === currentEditorPropId &&
        currentEditorPropId !== "init"
      ) {
        const saveState = savePluginKey.getState(editorView.state);
        if (
          saveState &&
          saveState.status !== "saving" &&
          saveState.status !== "debouncing"
        ) {
          setSaveStatus(editorView, { triggerSave: true });
        }
      }
    };

    const handleForceSave = createForceSaveHandler(currentDocumentIdRef);
    const wrappedForceSave = async (event: CustomEvent) => {
      const editorView = editorRef.current;
      if (!editorView) return;
      
      try {
        const content = buildContentFromDocument(editorView.state.doc);
        const result = await handleForceSave({ 
          ...event, 
          detail: { ...event.detail, content } 
        });
        
        if (result && editorView) {
          setSaveStatus(editorView, result);
        }
      } catch (error) {
        console.error("Force save failed:", error);
      }
    };

    window.addEventListener("editor:creation-stream-finished", handleCreationStreamFinished as EventListener);
    window.addEventListener("editor:force-save-document", wrappedForceSave as unknown as EventListener);

    return () => {
      window.removeEventListener("editor:creation-stream-finished", handleCreationStreamFinished as EventListener);
      window.removeEventListener("editor:force-save-document", wrappedForceSave as unknown as EventListener);
    };
  }, [documentId]);

  return (
    <>
      {isCurrentVersion && documentId !== "init" && (
        <EditorToolbar activeFormats={activeFormats as unknown as Record<string, boolean>} />
      )}
      <div 
        className="editor-area bg-background text-foreground dark:bg-black dark:text-white prose prose-slate dark:prose-invert pt-4" 
        ref={containerRef} 
      />
      {/* Synonym overlay */}
      <SynonymOverlay
        isOpen={synonymState.isOpen}
        synonyms={synonymState.synonyms}
        position={synonymState.position}
        onClose={() => setSynonymState(s => ({...s, isOpen:false}))}
        view={synonymState.view}
        from={synonymState.from}
        to={synonymState.to}
      />
      <style jsx global>{`
        .suggestion-decoration-inline::after {
          content: attr(data-suggestion);
          color: inherit;
          opacity: 0.5;
          pointer-events: none;
          user-select: none;
          font-family: inherit;
          font-size: inherit;
          line-height: inherit;
          white-space: pre-wrap;
          vertical-align: initial;
        }

        .ProseMirror .is-placeholder-empty::before {
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
        }

        .ProseMirror:focus {
          outline: none;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }

        .inline-suggestion-loader {
          display: inline-block;
          width: 1.5px;
          height: 1.2em;
          background-color: currentColor;
          animation: inline-suggestion-caret-pulse 1.1s infinite;
          vertical-align: text-bottom;
          opacity: 0.5;
        }

        @keyframes inline-suggestion-caret-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.1; }
        }

        .suggestion-context-highlight {
          background-color: rgba(255, 255, 0, 0.25);
          transition: background-color 0.3s ease-in-out;
        }

        .suggestion-context-loading {
          background-color: rgba(255, 220, 0, 0.35);
          animation: pulse-animation 1.5s infinite ease-in-out;
        }

        @keyframes pulse-animation {
          0% { background-color: rgba(255, 220, 0, 0.35); }
          50% { background-color: rgba(255, 230, 80, 0.5); }
          100% { background-color: rgba(255, 220, 0, 0.35); }
        }

        [data-diff] {
          transition: background-color 0.5s ease-in-out, color 0.5s ease-in-out, opacity 0.5s ease-in-out, max-height 0.5s ease-in-out;
        }

        .applying-changes [data-diff="1"] {
          background-color: transparent;
        }

        .applying-changes [data-diff="-1"] {
          text-decoration: none;
          opacity: 0;
          overflow: hidden;
          max-height: 0;
        }

        .editor-area, .toolbar {
          max-width: 720px;
          margin: 0 auto;
        }

        /* Persistent highlight while overlay is open */
        .synonym-loading {
          background-color: rgba(0, 0, 0, 0.07);
        }
        .dark .synonym-loading {
          background-color: rgba(255, 255, 255, 0.18);
        }
      `}</style>
    </>
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.documentId === nextProps.documentId &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content
  );
}

export const Editor = memo(PureEditor, areEqual);


