"use client";

import React, { useEffect, useRef, useState } from "react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { history } from "@milkdown/plugin-history";
import { cursor } from "@milkdown/plugin-cursor";
import { clipboard } from "@milkdown/plugin-clipboard";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import { replaceAll } from "@milkdown/kit/utils";
import type { EditorView } from "@milkdown/kit/prose/view";
import { EditorToolbar } from "@/components/document/editor-toolbar";
import { updateDocumentContent } from "@/app/documents/actions";

type MilkdownEditorProps = {
    content: string;
    status: "streaming" | "idle";
    isCurrentVersion: boolean | undefined;
    currentVersionIndex: number;
    documentId: string;
    initialLastSaved: Date | null;
    onStatusChange?: (status: any) => void;
    onCreateDocumentRequest?: (initialContent: string) => void;
};

function MilkdownEditor({
    content,
    status,
    isCurrentVersion,
    currentVersionIndex,
    documentId,
    initialLastSaved,
    onStatusChange,
    onCreateDocumentRequest,
}: MilkdownEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const editorInstanceRef = useRef<Editor | null>(null);
    const [isReady, setIsReady] = useState(false);
    const initializedRef = useRef(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentContentRef = useRef<string>('');

    // Helper function to update content using Milkdown's replaceAll utility
    const updateEditorContent = async (editor: Editor, newContent: string) => {
        try {
            await editor.action(replaceAll(newContent));
            currentContentRef.current = newContent;
            console.log('[MilkdownEditor] Content updated successfully');
        } catch (error) {
            console.error('[MilkdownEditor] Failed to update content:', error);
            // Fallback: try to update via direct DOM manipulation if available
            try {
                await editor.action((ctx) => {
                    const view = ctx.get('editorView') as unknown as EditorView;
                    if (view && view.state) {
                        const { state } = view;
                        const { schema } = state;
                        // Simple fallback: create a paragraph with the new content
                        const node = schema.nodes.paragraph.create({}, [schema.text(newContent)]);
                        const doc = schema.topNodeType.create({}, [node]);
                        const tr = state.tr.replaceWith(0, state.doc.content.size, doc.content);
                        view.dispatch(tr);
                        currentContentRef.current = newContent;
                    }
                });
            } catch (fallbackError) {
                console.error('[MilkdownEditor] Fallback update also failed:', fallbackError);
            }
        }
    };

    // Initialize Milkdown editor
    useEffect(() => {
        if (!editorRef.current || initializedRef.current) return;

        const initEditor = async () => {
            try {
                const editor = Editor.make()
                    .config((ctx) => {
                        ctx.set(rootCtx, editorRef.current!);
                        ctx.set(defaultValueCtx, content || "");
                        ctx.set(editorViewOptionsCtx, {
                            editable: () => !!isCurrentVersion,
                        });
                    })
                    .use(commonmark)
                    .use(history)
                    .use(cursor)
                    .use(clipboard)
                    .use(listener);

                const instance = await editor.create();

                console.log("Milkdown editor is ready!");
                editorInstanceRef.current = instance;
                setIsReady(true);
                initializedRef.current = true;
                currentContentRef.current = content || "";

                // Set up content change listener for database saving
                instance.action((ctx) => {
                    const listenerInstance = ctx.get(listenerCtx);
                    listenerInstance.markdownUpdated((_ctx, markdown: string) => {
                        currentContentRef.current = markdown;

                        // Debounced save to database
                        if (saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                        }
                        saveTimeoutRef.current = setTimeout(async () => {
                            try {
                                if (documentId && documentId !== 'init' && documentId.length > 10) {
                                    await updateDocumentContent({
                                        id: documentId,
                                        content: markdown,
                                    });
                                    console.log('[MilkdownEditor] Content saved successfully');
                                }
                            } catch (error) {
                                console.error('[MilkdownEditor] Save failed:', error);
                            }
                        }, 2000);
                    });
                });

            } catch (error) {
                console.error('[MilkdownEditor] Editor initialization failed:', error);
            }
        };

        initEditor();

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (editorInstanceRef.current) {
                editorInstanceRef.current.destroy();
                editorInstanceRef.current = null;
                setIsReady(false);
                initializedRef.current = false;
            }
        };
    }, [documentId, isCurrentVersion]);

    // Handle AI streaming and events
    useEffect(() => {
        if (!editorInstanceRef.current || !isReady) return;

        const handleStream = (evt: Event) => {
            const event = evt as CustomEvent;
            const { documentId: streamDocumentId, content: streamContent } = event.detail;

            if (streamDocumentId !== documentId || !editorInstanceRef.current) return;

            const newContent = currentContentRef.current + streamContent;
            console.log('[MilkdownEditor] Streaming content update');
            updateEditorContent(editorInstanceRef.current, newContent);
        };

        const handleDocumentUpdate = (evt: Event) => {
            const event = evt as CustomEvent;
            const { type, content: eventContent } = event.detail;

            if (type !== 'documentUpdate' || !eventContent || !editorInstanceRef.current) return;

            try {
                const updateData = JSON.parse(eventContent);
                if (updateData.newContent) {
                    console.log('[MilkdownEditor] Document update received');
                    updateEditorContent(editorInstanceRef.current, updateData.newContent);
                }
            } catch (error) {
                console.error('[MilkdownEditor] Parse update failed:', error);
            }
        };

        const handleForceSave = (evt: Event) => {
            const event = evt as CustomEvent;
            const { documentId: saveDocumentId } = event.detail;
            if (saveDocumentId === documentId) {
                onStatusChange?.({ status: 'saving' });
            }
        };

        const handleCreationStreamFinished = (evt: Event) => {
            const event = evt as CustomEvent;
            const { documentId: finishedDocumentId } = event.detail;
            if (finishedDocumentId === documentId) {
                onStatusChange?.({ status: 'saved' });
            }
        };

        window.addEventListener('editor:stream-text', handleStream);
        window.addEventListener('editor:stream-data', handleDocumentUpdate);
        window.addEventListener('editor:force-save-document', handleForceSave);
        window.addEventListener('editor:creation-stream-finished', handleCreationStreamFinished);

        return () => {
            window.removeEventListener('editor:stream-text', handleStream);
            window.removeEventListener('editor:stream-data', handleDocumentUpdate);
            window.removeEventListener('editor:force-save-document', handleForceSave);
            window.removeEventListener('editor:creation-stream-finished', handleCreationStreamFinished);
        };
    }, [documentId, onStatusChange, isReady]);

    // Update editor content when content prop changes
    useEffect(() => {
        if (!editorInstanceRef.current || !isReady || !content) return;

        if (content !== currentContentRef.current) {
            console.log('[MilkdownEditor] Loading new content');
            updateEditorContent(editorInstanceRef.current, content);
        }
    }, [content, isReady]);

    return (
        <>
            {isCurrentVersion && documentId !== "init" && (
                <EditorToolbar activeFormats={{}} />
            )}
            <div
                ref={editorRef}
                className="editor-area bg-background text-foreground dark:bg-black dark:text-white prose prose-slate dark:prose-invert pt-4 milkdown-editor"
                style={{
                    opacity: isReady ? 1 : 0,
                    transition: 'opacity 0.2s ease-in-out',
                    pointerEvents: isCurrentVersion ? 'auto' : 'none'
                }}
            />
            <style jsx>{`
                .milkdown-editor {
                    /* Basic Milkdown styling */
                }
                .milkdown-editor .editor {
                    outline: none;
                }
                .milkdown-editor h1 {
                    font-size: 2em;
                    font-weight: bold;
                    margin: 1em 0 0.5em 0;
                    line-height: 1.2;
                }
                .milkdown-editor h2 {
                    font-size: 1.5em;
                    font-weight: bold;
                    margin: 1em 0 0.5em 0;
                    line-height: 1.3;
                }
                .milkdown-editor h3 {
                    font-size: 1.25em;
                    font-weight: bold;
                    margin: 1em 0 0.5em 0;
                    line-height: 1.4;
                }
                .milkdown-editor ul {
                    list-style-type: disc;
                    margin: 1em 0;
                    padding-left: 2em;
                }
                .milkdown-editor ol {
                    list-style-type: decimal;
                    margin: 1em 0;
                    padding-left: 2em;
                }
                .milkdown-editor li {
                    margin: 0.25em 0;
                }
                .milkdown-editor p {
                    margin: 1em 0;
                    line-height: 1.6;
                }
                .milkdown-editor pre {
                    background: #f5f5f5;
                    border-radius: 4px;
                    padding: 1em;
                    margin: 1em 0;
                    overflow-x: auto;
                }
                .milkdown-editor code {
                    background: #f5f5f5;
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                    font-family: monospace;
                }
                .milkdown-editor pre code {
                    background: transparent;
                    padding: 0;
                }
                /* Dark mode styles */
                .dark .milkdown-editor pre {
                    background: #1a1a1a;
                }
                .dark .milkdown-editor code {
                    background: #1a1a1a;
                }
            `}</style>
        </>
    );
}

export default MilkdownEditor;
