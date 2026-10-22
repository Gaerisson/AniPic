import "./writing314.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Check,
  X,
  Copy,
} from "lucide-react";
import {
  writingCorrections,
  localWritingIssues,
} from "../shared/writing-corrections.mjs";
import { Button } from "./ui.jsx";
import { copyText } from "./api.js";

const key = new PluginKey("anipic-writing-corrections");
const documentFromText = (value) => ({
  type: "doc",
  content: String(value || "")
    .split(/\n\s*\n/)
    .map((p) => ({
      type: "paragraph",
      content: p
        .split("\n")
        .flatMap((line, index) => [
          ...(index ? [{ type: "hardBreak" }] : []),
          ...(line ? [{ type: "text", text: line }] : []),
        ]),
    })),
});
const publicText = (editor) => editor.getText({ blockSeparator: "\n\n" });
function positions(doc) {
  const map = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      const start = doc.textBetween(0, pos, "\n\n", "\n").length;
      for (let i = 0; i <= node.text.length; i++) map[start + i] = pos + i;
    }
  });
  return (offset) => {
    if (map[offset] !== undefined) return map[offset];
    for (let i = offset; i >= 0; i--)
      if (map[i] !== undefined)
        return Math.min(doc.content.size - 1, map[i] + offset - i);
    return 1;
  };
}
const CorrectionMarks = Extension.create({
  name: "correctionMarks",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        state: {
          init: () => [],
          apply: (tr, old) => tr.getMeta(key) ?? (tr.docChanged ? [] : old),
        },
        props: {
          decorations(state) {
            const at = positions(state.doc);
            return DecorationSet.create(
              state.doc,
              key.getState(state).map((issue) => {
                const from = at(issue.from),
                  to = at(issue.to);
                const attrs = {
                  class: "writing-issue",
                  "data-correction": String(issue.id),
                  title:
                    issue.message ||
                    `Proposition : ${issue.after || "retirer"}`,
                };
                return to > from
                  ? Decoration.inline(from, to, attrs)
                  : Decoration.widget(from, () => {
                      const span = document.createElement("span");
                      Object.entries(attrs).forEach(([k, v]) =>
                        span.setAttribute(k, v),
                      );
                      span.textContent = "▏";
                      return span;
                    });
              }),
            );
          },
        },
      }),
    ];
  },
});
export default function RichWriting({
  value,
  onChange,
  proposed,
  placeholder = "Écrivez ici…",
  label = "Éditeur de texte",
  maxLength = 8000,
  notify = () => {},
}) {
  const change = useRef(onChange),
    latest = useRef(value);
  change.current = onChange;
  latest.current = value;
  const [revision, setRevision] = useState(0),
    [active, setActive] = useState(null),
    [ignored, setIgnored] = useState([]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder }),
      CorrectionMarks,
    ],
    content: documentFromText(value),
    editorProps: {
      attributes: {
        lang: "fr",
        spellcheck: "true",
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor }) => {
      const text = publicText(editor);
      change.current?.(text);
      setRevision((v) => v + 1);
    },
    onSelectionUpdate: () => setRevision((v) => v + 1),
  });
  const issues = useMemo(
    () =>
      (proposed != null
        ? writingCorrections(value || "", proposed)
        : localWritingIssues(value || "")
      ).filter(
        (i) => !ignored.includes(i.from + ":" + i.before + ":" + i.after),
      ),
    [value, proposed, ignored],
  );
  useEffect(() => {
    setIgnored([]);
    setActive(null);
  }, [proposed]);
  useEffect(() => {
    if (editor && publicText(editor) !== String(value || ""))
      editor.commands.setContent(documentFromText(value), {
        emitUpdate: false,
      });
  }, [editor, value]);
  useEffect(() => {
    if (editor && !editor.isDestroyed)
      editor.view.dispatch(editor.state.tr.setMeta(key, issues));
  }, [editor, issues, revision]);
  if (!editor) return null;
  const apply = (issue) => {
    const at = positions(editor.state.doc);
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: at(issue.from), to: at(issue.to) },
        issue.after ? { type: "text", text: issue.after } : [],
      )
      .run();
    setActive(null);
  };
  const mark = (issue) => {
    setActive(issue.id);
    const at = positions(editor.state.doc);
    editor
      .chain()
      .focus()
      .setTextSelection({ from: at(issue.from), to: at(issue.to) })
      .scrollIntoView()
      .run();
  };
  const current = issues.find((i) => i.id === active) || issues[0];
  return (
    <div
      className="rich-writing"
      onClick={(e) => {
        const node = e.target.closest("[data-correction]");
        if (node)
          setActive(
            issues.find((i) => String(i.id) === node.dataset.correction)?.id,
          );
      }}
    >
      <div className="rich-toolbar" role="toolbar" aria-label="Mise en forme">
        <button
          type="button"
          title="Gras"
          aria-pressed={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          title="Italique"
          aria-pressed={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          title="Liste à puces"
          aria-pressed={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          title="Liste numérotée"
          aria-pressed={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </button>
        <span />
        <button
          type="button"
          title="Annuler"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          title="Rétablir"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
      </div>
      <EditorContent editor={editor} />
      {issues.length > 0 && (
        <section
          className="writing-correction-panel"
          aria-label="Corrections proposées"
        >
          <header>
            <strong>{issues.length} proposition(s) dans le texte</strong>
            {proposed != null && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  editor.commands.setContent(documentFromText(proposed));
                  setActive(null);
                }}
              >
                Tout appliquer
              </Button>
            )}
          </header>
          <div className="writing-correction-chips">
            {issues.slice(0, 40).map((i) => (
              <button
                type="button"
                key={i.id}
                aria-pressed={current?.id === i.id}
                onClick={() => mark(i)}
              >
                {i.before.trim().slice(0, 20) || "Ponctuation / ajout"}
              </button>
            ))}
          </div>
          {current && (
            <div className="writing-correction-detail">
              <p>{current.message || "Correction proposée"}</p>
              <div>
                <del>{current.before || "(ajout)"}</del>
                <span>→</span>
                <ins>{current.after || "(retirer)"}</ins>
              </div>
              <Button icon={Check} type="button" onClick={() => apply(current)}>
                Appliquer
              </Button>
              <Button
                icon={X}
                type="button"
                variant="secondary"
                onClick={() => {
                  setIgnored([
                    ...ignored,
                    current.from + ":" + current.before + ":" + current.after,
                  ]);
                  setActive(null);
                }}
              >
                Ignorer
              </Button>
            </div>
          )}
        </section>
      )}
      <footer>
        <span>
          {String(value || "").length.toLocaleString("fr-FR")} /{" "}
          {maxLength.toLocaleString("fr-FR")} caractères
          {String(value || "").length > maxLength
            ? " · raccourcissez ce texte avant génération"
            : ""}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              const text = publicText(editor),
                html = editor.getHTML();
              if (window.ClipboardItem && navigator.clipboard?.write)
                await navigator.clipboard.write([
                  new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([text], { type: "text/plain" }),
                  }),
                ]);
              else await copyText(text);
              notify(
                "Texte copié avec sa mise en forme lorsque le navigateur le permet.",
              );
            } catch {
              notify("Copie impossible sur cet appareil.");
            }
          }}
        >
          <Copy size={13} /> Copier
        </button>
      </footer>
    </div>
  );
}
