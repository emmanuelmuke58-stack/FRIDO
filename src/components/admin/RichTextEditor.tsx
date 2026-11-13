import React, { useRef, useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Image as ImageIcon } from 'lucide-react';
import { MediaPickerModal } from './MediaPickerModal';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'image', 'video'],
    ['clean'],
    [{ 'align': [] }],
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet',
  'link', 'image', 'video',
  'align'
];

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const quillRef = useRef<any>(null);
  const [isMediaOpen, setMediaOpen] = useState(false);

  const handleInsertMedia = (url: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const range = editor.getSelection(true);
      const index = range ? range.index : editor.getLength();
      editor.insertEmbed(index, 'image', url, 'user');
      editor.setSelection(index + 1);
    } else {
      onChange(`${value || ''}<p><img src="${url}" alt="Article media" /></p>`);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-slate-200 focus-within:border-teal-500 transition-all">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rich Content Editor</span>
        <button
          type="button"
          onClick={() => setMediaOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 hover:border-teal-500 hover:text-teal-600 rounded-lg text-xs font-bold text-slate-600 transition-all shadow-sm"
        >
          <ImageIcon size={14} /> Insert from Media Library
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
        className="min-h-[400px]"
      />
      <MediaPickerModal
        isOpen={isMediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleInsertMedia}
      />
    </div>
  );
}
