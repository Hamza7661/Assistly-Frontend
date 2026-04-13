'use client';

import { useEffect, useMemo, useRef } from 'react';
import type Quill from 'quill';
import 'quill/dist/quill.snow.css';

type Props = {
  value: string;
  onChange: (html: string) => void;
  maxLength?: number;
  placeholder?: string;
};

function textLenApprox(html: string): number {
  if (!html) return 0;
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

function normalizeHtml(html: string): string {
  const n = (html || '').replace(/>\s+</g, '><').trim();
  if (!n || n === '<p><br></p>' || n === '<p></p>') return '';
  return n;
}

function toStoredHtml(rootInnerHtml: string): string {
  const n = normalizeHtml(rootInnerHtml);
  return n === '' ? '' : rootInnerHtml.trim();
}

export default function PostBookingNoteEditor({
  value,
  onChange,
  maxLength = 8000,
  placeholder = 'Instructions after booking (bullet lists, bold, etc.)',
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const maxLengthRef = useRef(maxLength);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  maxLengthRef.current = maxLength;
  valueRef.current = value;

  const modules = useMemo(
    () => ({
      toolbar: [['bold', 'italic'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']],
    }),
    []
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let disposed = false;
    const container = document.createElement('div');
    wrapper.appendChild(container);

    const setup = import('quill').then(({ default: Quill }) => {
      if (disposed || !wrapperRef.current?.contains(container)) return;

      const quill = new Quill(container, {
        theme: 'snow',
        modules,
        placeholder,
        formats: ['bold', 'italic', 'list', 'bullet'],
      });
      quillRef.current = quill;

      const v = valueRef.current || '';
      quill.clipboard.dangerouslyPasteHTML(v, 'silent');

      const handleTextChange = () => {
        const html = quill.root.innerHTML;
        const stored = toStoredHtml(html);
        const len = textLenApprox(stored);
        if (len > maxLengthRef.current) {
          (quill as Quill & { history: { undo: () => void } }).history.undo();
          return;
        }
        onChangeRef.current(stored);
      };

      quill.on('text-change', (_delta, _oldDelta, source) => {
        if (source !== 'user') return;
        handleTextChange();
      });
    });

    return () => {
      disposed = true;
      quillRef.current = null;
      wrapper.innerHTML = '';
    };
  }, [modules, placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const cur = normalizeHtml(quill.root.innerHTML);
    const next = normalizeHtml(value || '');
    if (cur === next) return;
    quill.clipboard.dangerouslyPasteHTML(value || '', 'silent');
  }, [value]);

  return (
    <div className="post-booking-note-editor">
      <div
        ref={wrapperRef}
        className="bg-white rounded-md border border-gray-200 [&_.ql-container]:min-h-[100px] [&_.ql-editor]:text-sm [&_.ql-toolbar]:rounded-t-md [&_.ql-container]:rounded-b-md"
      />
      <div className="text-right text-xs text-gray-400 mt-1">
        {textLenApprox(value || '')}/{maxLength} characters (approx.)
      </div>
    </div>
  );
}
