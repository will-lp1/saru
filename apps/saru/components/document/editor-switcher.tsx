"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Editor } from "./editor";
import MilkdownEditor from "./milkdown-editor";
import { Settings, Zap, FileText } from "lucide-react";

type EditorType = "prosemirror" | "milkdown";

interface EditorSwitcherProps {
    content: string;
    status: "streaming" | "idle";
    isCurrentVersion: boolean | undefined;
    currentVersionIndex: number;
    documentId: string;
    initialLastSaved: Date | null;
    onStatusChange?: (status: any) => void;
    onCreateDocumentRequest?: (initialContent: string) => void;
}

export function EditorSwitcher({
    content,
    status,
    isCurrentVersion,
    currentVersionIndex,
    documentId,
    initialLastSaved,
    onStatusChange,
    onCreateDocumentRequest,
}: EditorSwitcherProps) {
    const [editorType, setEditorType] = useState<EditorType>("prosemirror");
    const [showSwitcher, setShowSwitcher] = useState(false);

    const handleEditorSwitch = (type: EditorType) => {
        setEditorType(type);
        setShowSwitcher(false);
    };

    const editorProps = {
        content,
        status,
        isCurrentVersion,
        currentVersionIndex,
        documentId,
        initialLastSaved,
        onStatusChange,
        onCreateDocumentRequest,
    };

    return (
        <div className="relative">
            {/* Editor Type Indicator and Switcher */}
            <div className="absolute top-16 right-4 z-50">
                <div className="flex items-center gap-2">
                    {showSwitcher && (
                        <div className="flex gap-1 bg-background border rounded-lg p-1 shadow-lg">
                            <Button
                                variant={editorType === "prosemirror" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => handleEditorSwitch("prosemirror")}
                                className="flex items-center gap-1"
                            >
                                <FileText className="h-3 w-3" />
                                ProseMirror
                            </Button>
                            <Button
                                variant={editorType === "milkdown" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => handleEditorSwitch("milkdown")}
                                className="flex items-center gap-1"
                            >
                                <Zap className="h-3 w-3" />
                                Milkdown
                            </Button>
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSwitcher(!showSwitcher)}
                        className="flex items-center gap-1"
                    >
                        <Settings className="h-3 w-3" />
                        {editorType === "prosemirror" ? (
                            <Badge variant="secondary" className="ml-1">ProseMirror</Badge>
                        ) : (
                            <Badge variant="default" className="ml-1">Milkdown</Badge>
                        )}
                    </Button>
                </div>
            </div>

            {/* Render the selected editor */}
            {editorType === "prosemirror" ? (
                <Editor key="prosemirror" {...editorProps} />
            ) : (
                <MilkdownEditor key="milkdown" {...editorProps} />
            )}

            {/* Experimental notice for Milkdown */}
            {editorType === "milkdown" && (
                <div className="absolute top-20 right-4 z-40">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200 text-xs">
                        🧪 Experimental
                    </Badge>
                </div>
            )}
        </div>
    );
}
