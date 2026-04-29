"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./LanguageProvider";

type RichTextEditorValue = {
  html: string;
  text: string;
};

type RichTextEditorProps = {
  value: RichTextEditorValue;
  onChange: (next: RichTextEditorValue) => void;
  placeholder?: string;
  editorId?: string;
  minHeightClassName?: string;
  disabled?: boolean;
  showToolbar?: boolean;
};

function exec(command: string, value?: string) {
  try {
    document.execCommand(command, false, value);
  } catch {
    // Ignore unsupported commands
  }
}

function wrapSelectionWithSpanStyle(style: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const container = document.createElement("div");
  container.appendChild(range.cloneContents());
  const selectedHtml = container.innerHTML || sel.toString();

  exec(
    "insertHTML",
    `<span style="${style.replace(/\"/g, "&quot;")}">${selectedHtml}</span>`,
  );
}

const RichTextEditor = forwardRef<HTMLDivElement, RichTextEditorProps>(
  function RichTextEditor(
    {
      value,
      onChange,
      placeholder,
      editorId,
      minHeightClassName,
      disabled,
      showToolbar = true,
    },
    forwardedRef,
  ) {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const language = useLanguage();
    const [textColor, setTextColor] = useState("#0f172a");
    const [highlightColor, setHighlightColor] = useState("#fde047");

    const ui = useMemo(() => {
      if (language === "fr") {
        return {
          fontAria: "Police",
          fontSans: "Sans",
          fontSerif: "Serif",
          fontMono: "Mono",
          sizeAria: "Taille",
          boldAria: "Gras",
          underlineAria: "Souligné",
          strikeAria: "Barré",
          colorLabel: "Couleur",
          textColorAria: "Couleur du texte",
          highlightLabel: "Surligner",
          highlightColorAria: "Couleur de surlignage",
          alignLeftAria: "Aligner à gauche",
          centerAria: "Centrer",
          alignRightAria: "Aligner à droite",
        };
      }

      return {
        fontAria: "Font",
        fontSans: "Sans",
        fontSerif: "Serif",
        fontMono: "Mono",
        sizeAria: "Size",
        boldAria: "Bold",
        underlineAria: "Underline",
        strikeAria: "Strikethrough",
        colorLabel: "Color",
        textColorAria: "Text color",
        highlightLabel: "Highlight",
        highlightColorAria: "Highlight color",
        alignLeftAria: "Align left",
        centerAria: "Center",
        alignRightAria: "Align right",
      };
    }, [language]);

    const isEmpty = useMemo(() => {
      return !value.text.trim();
    }, [value.text]);

    useEffect(() => {
      const el = editorRef.current;
      if (!el) return;
      if ((el.innerHTML || "") !== (value.html || "")) {
        el.innerHTML = value.html || "";
      }
    }, [value.html]);

    const setEditorNode = (node: HTMLDivElement | null) => {
      editorRef.current = node;
      if (!forwardedRef) return;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else (forwardedRef as any).current = node;
    };

    return (
      <div className="overflow-hidden">
        <div className="relative">
          {placeholder && isEmpty ? (
            <div className="pointer-events-none absolute left-0 top-0 text-sm text-slate-400">
              {placeholder}
            </div>
          ) : null}

          <div
            ref={setEditorNode}
            id={editorId}
            className={
              (minHeightClassName || "min-h-[180px]") +
              " w-full bg-transparent py-0 text-sm text-slate-900 outline-none"
            }
            contentEditable={!disabled}
            suppressContentEditableWarning
            onInput={() => {
              if (disabled) return;
              const el = editorRef.current;
              if (!el) return;
              onChange({ html: el.innerHTML, text: el.innerText });
            }}
          />
        </div>

        {showToolbar && (
          <div className="toolbar flex flex-wrap items-center gap-2 border-t border-slate-200 px-2 py-2 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <select
              className="rounded-md bg-white/80 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-900/60"
              defaultValue="sans-serif"
              onChange={(e) => {
                if (disabled) return;
                editorRef.current?.focus();
                wrapSelectionWithSpanStyle(`font-family: ${e.target.value};`);
                const el = editorRef.current;
                if (el) onChange({ html: el.innerHTML, text: el.innerText });
              }}
              aria-label={ui.fontAria}
              disabled={disabled}
            >
              <option value="sans-serif">{ui.fontSans}</option>
              <option value="serif">{ui.fontSerif}</option>
              <option value="monospace">{ui.fontMono}</option>
            </select>

            <select
              className="rounded-md bg-white/80 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-900/60"
              defaultValue="14"
              onChange={(e) => {
                if (disabled) return;
                const sizePx = Number(e.target.value);
                editorRef.current?.focus();
                wrapSelectionWithSpanStyle(`font-size: ${sizePx}px;`);
                const el = editorRef.current;
                if (el) onChange({ html: el.innerHTML, text: el.innerText });
              }}
              aria-label={ui.sizeAria}
              disabled={disabled}
            >
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="24">24</option>
            </select>

            <button
              type="button"
              className="rounded-md bg-white/80 px-2 py-1 font-semibold text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => {
                if (disabled) return;
                editorRef.current?.focus();
                exec("bold");
                const el = editorRef.current;
                if (el) onChange({ html: el.innerHTML, text: el.innerText });
              }}
              aria-label={ui.boldAria}
              disabled={disabled}
            >
              B
            </button>

            <button
              type="button"
              className="rounded-md bg-white/80 px-2 py-1 font-semibold text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => {
                if (disabled) return;
                editorRef.current?.focus();
                exec("underline");
                const el = editorRef.current;
                if (el) onChange({ html: el.innerHTML, text: el.innerText });
              }}
              aria-label={ui.underlineAria}
              disabled={disabled}
            >
              U
            </button>

            <button
              type="button"
              className="rounded-md bg-white/80 px-2 py-1 font-semibold text-slate-700 hover:bg-white dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => {
                if (disabled) return;
                editorRef.current?.focus();
                exec("strikeThrough");
                const el = editorRef.current;
                if (el) onChange({ html: el.innerHTML, text: el.innerText });
              }}
              aria-label={ui.strikeAria}
              disabled={disabled}
            >
              S
            </button>

            <label className="inline-flex items-center gap-1">
              <span className="text-[11px]">{ui.colorLabel}</span>
              <input
                type="color"
                value={textColor}
                onChange={(e) => {
                  if (disabled) return;
                  const c = e.target.value;
                  setTextColor(c);
                  editorRef.current?.focus();
                  exec("foreColor", c);
                  const el = editorRef.current;
                  if (el) onChange({ html: el.innerHTML, text: el.innerText });
                }}
                className="h-7 w-7 rounded bg-white p-0 dark:bg-slate-900"
                aria-label={ui.textColorAria}
                disabled={disabled}
              />
            </label>

            <label className="inline-flex items-center gap-1">
              <span className="text-[11px]">{ui.highlightLabel}</span>
              <input
                type="color"
                value={highlightColor}
                onChange={(e) => {
                  if (disabled) return;
                  const c = e.target.value;
                  setHighlightColor(c);
                  editorRef.current?.focus();
                  exec("hiliteColor", c);
                  exec("backColor", c);
                  const el = editorRef.current;
                  if (el) onChange({ html: el.innerHTML, text: el.innerText });
                }}
                className="h-7 w-7 rounded bg-white p-0 dark:bg-slate-900"
                aria-label={ui.highlightColorAria}
                disabled={disabled}
              />
            </label>

            <div className="ml-auto inline-flex items-center gap-1">
              <button
                type="button"
                className="rounded-md bg-white/80 p-1.5 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900"
                onClick={() => {
                  if (disabled) return;
                  editorRef.current?.focus();
                  exec("justifyLeft");
                  const el = editorRef.current;
                  if (el) onChange({ html: el.innerHTML, text: el.innerText });
                }}
                aria-label={ui.alignLeftAria}
                disabled={disabled}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h10" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                className="rounded-md bg-white/80 p-1.5 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900"
                onClick={() => {
                  if (disabled) return;
                  editorRef.current?.focus();
                  exec("justifyCenter");
                  const el = editorRef.current;
                  if (el) onChange({ html: el.innerHTML, text: el.innerText });
                }}
                aria-label={ui.centerAria}
                disabled={disabled}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M4 6h16" />
                  <path d="M7 12h10" />
                  <path d="M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                className="rounded-md bg-white/80 p-1.5 hover:bg-white dark:bg-slate-900/60 dark:hover:bg-slate-900"
                onClick={() => {
                  if (disabled) return;
                  editorRef.current?.focus();
                  exec("justifyRight");
                  const el = editorRef.current;
                  if (el) onChange({ html: el.innerHTML, text: el.innerText });
                }}
                aria-label={ui.alignRightAria}
                disabled={disabled}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M4 6h16" />
                  <path d="M10 12h10" />
                  <path d="M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

export default RichTextEditor;
