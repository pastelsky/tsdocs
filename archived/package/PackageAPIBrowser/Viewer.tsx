import Editor from "@monaco-editor/react";
import { useRef } from "react";

import React from "react";

const Viewer = ({ content }: { content: string }) => {
  const editorRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    // here is the editor instance
    // you can store it in `useRef` for further usage
    editorRef.current = editor;
    console.log("theme", editor.theme);
    monaco.editor.setTheme("vs-dark");
    editor.trigger("fold", "editor.foldImports");
  }

  return (
    <Editor
      height="100vh"
      defaultLanguage="typescript"
      defaultValue={content}
      onMount={handleEditorDidMount}
      options={{
        lineNumbers: "interval",
        theme: "vs-dark",
        guides: {
          highlightActiveIndentation: false,
          indentation: false,
        },
        minimap: {
          enabled: false,
        },
        showDeprecated: true,
        showFoldingControls: "always",
        showUnused: true,
        wordWrap: "on",
        wordWrapBreakAfterCharacters: "80",
        scrollBeyondLastLine: false,
        hideCursorInOverviewRuler: true,
        foldingImportsByDefault: true,
        contextmenu: false,
        codeLens: false,
        colorDecorators: true,
        readOnly: true,
        cursorStyle: "underline-thin",
        fontFamily: "'JetBrains Mono', 'Fira Code', consolas, monospace",
        fontLigatures: true,
        fontSize: 12.5,
      }}
    />
  );
};

export default Viewer;
