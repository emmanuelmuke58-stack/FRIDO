import React, { useMemo, useRef, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Upload } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list',
  'link', 'image', 'video',
  'align'
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const quillRef = useRef<any>(null);
  const [isMediaOpen, setMediaOpen] = useState(false);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike', 'blockquote'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image', 'video'],
          ['clean'],
          [{ align: [] }],
        ],
        handlers: {
          image: () => {
            setMediaOpen(true);
          },
        },
      },
    }),
    []
  );

  const handleInsertMedia = (url: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const range = editor.getSelection(true);
      const index = range ? range.index : editor.getLength();
      editor.insertEmbed(index, 'image', url, 'user');
      editor.setSelection(index + 1);
    } else {
      onChange(`${value || ''}<p><img src="${url}" alt="Article media"/></p>`);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 focus-within:border-teal-500 transition-all max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rich Content Editor</span>
        <button
          type="button"
          onClick={() => setMediaOpen(true)}
          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-600 rounded-lg text-xs font-bold text-slate-600 transition-all shadow-sm cursor-pointer">
          <Upload size={14} /> Upload / Insert Image
        </button>
      </div>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="min-h-[280px] sm:min-h-[380px]"
      />
      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleInsertMedia}
        filterType="image"
      />
    </div>
  );
}

