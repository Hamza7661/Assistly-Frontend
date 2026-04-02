'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

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

export default function PostBookingNoteEditor({
  value,
  onChange,
  maxLength = 8000,
  placeholder = 'Instructions after booking (bullet lists, bold, etc.)',
}: Props) {
  const modules = useMemo(
    () => ({
      toolbar: [['bold', 'italic'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']],
    }),
    []
  );

  const formats = useMemo(() => ['bold', 'italic', 'list', 'bullet'], []);

  const handleChange = (html: string) => {
    if (html.length > maxLength) {
      onChange(html.slice(0, maxLength));
      return;
    }
    onChange(html);
  };

  return (
    <div className="post-booking-note-editor">
      <ReactQuill
        theme="snow"
        value={value || ''}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-white rounded-md border border-gray-200 [&_.ql-container]:min-h-[100px] [&_.ql-editor]:text-sm"
      />
      <div className="text-right text-xs text-gray-400 mt-1">
        {textLenApprox(value || '')}/{maxLength} characters (approx.)
      </div>
    </div>
  );
}
