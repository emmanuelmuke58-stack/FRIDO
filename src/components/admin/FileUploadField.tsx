import React from 'react';
import {
  Upload,
  Camera,
  FileText,
  Trash2,
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DOCUMENT_ACCEPT,
  UploadedMediaResult,
  uploadMediaFile,
  validateUploadFile,
  deleteAssetByUrl,
  extractMediaAssetId,
  formatFileSize,
} from '../../lib/mediaUpload';
import { MediaPickerModal } from './MediaPickerModal';

export interface FileUploadFieldProps {
  value?: string;
  onChange: (url: string, meta?: UploadedMediaResult) => void;
  label?: string;
  helperText?: string;
  allowLibraryPicker?: boolean;
  allowUrlInput?: boolean;
  registerMedia?: boolean;
  className?: string;
}

export function FileUploadField({
  value = '',
  onChange,
  label,
  helperText,
  allowLibraryPicker = true,
  allowUrlInput = true,
  registerMedia = true,
  className,
}: FileUploadFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const sessionUploadedUrlRef = React.useRef<string | null>(null);

  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [uploadedName, setUploadedName] = React.useState<string>('');
  const [statusMsg, setStatusMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const handleFileChosen = async (file: File | undefined | null) => {
    if (!file) return;
    const err = validateUploadFile(file, 'document');
    if (err) {
      setStatusMsg({ type: 'error', text: err });
      return;
    }

    setUploading(true);
    setProgress(8);
    setStatusMsg(null);

    try {
      const previousSessionUrl = sessionUploadedUrlRef.current;
      const res = await uploadMediaFile({
        file,
        kind: 'document',
        registerMedia,
        onProgress: (pct) => setProgress(pct),
      });

      if (
        previousSessionUrl &&
        previousSessionUrl !== res.url &&
        extractMediaAssetId(previousSessionUrl) !== res.assetId
      ) {
        deleteAssetByUrl(previousSessionUrl).catch(() => {});
      }

      sessionUploadedUrlRef.current = res.url;
      setUploadedName(res.name);
      onChange(res.url, res);
      setStatusMsg({
        type: 'success',
        text: `Uploaded ${res.name} (${formatFileSize(res.size)})`,
      });
    } catch (e: any) {
      setStatusMsg({
        type: 'error',
        text: e?.message || 'File upload failed.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    const ownedSessionUrl = sessionUploadedUrlRef.current;
    if (ownedSessionUrl && ownedSessionUrl === value) {
      await deleteAssetByUrl(ownedSessionUrl).catch(() => {});
      sessionUploadedUrlRef.current = null;
    }
    setUploadedName('');
    setStatusMsg(null);
    onChange('');
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      handleFileChosen(dropped);
    }
  };

  const displayName =
    uploadedName ||
    (value ? decodeURIComponent(value.split('/').pop()?.split('?')[0] || 'Attached Document') : '');

  const downloadHref =
    value && value.includes('/api/media/')
      ? `${value}${value.includes('?') ? '&' : '?'}download=1`
      : value;

  return (
    <div className={cn('space-y-2.5 min-w-0', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            {label}
          </label>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="text-[11px] font-bold text-red-500 hover:text-red-700 inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            >
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleFileChosen(f);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleFileChosen(f);
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed transition-all p-3 sm:p-4 bg-slate-50/70',
          dragging
            ? 'border-teal-500 bg-teal-50/50'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {value ? (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#083D91] flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#102B4E] truncate">{displayName}</p>
                <p className="text-[10px] font-mono text-slate-400 truncate">{value}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open file"
                  className="min-w-[34px] min-h-[34px] rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <ExternalLink size={14} />
                </a>
                <a
                  href={downloadHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download file"
                  className="min-w-[34px] min-h-[34px] rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center"
                >
                  <Download size={14} />
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} /> Replace File
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Camera size={13} /> Scan Photo
              </button>
              {allowLibraryPicker && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setPickerOpen(true)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#083D91] text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FolderOpen size={13} /> Library
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-3 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#083D91] flex items-center justify-center mx-auto">
              <FileText size={20} />
            </div>
            <div className="space-y-0.5 px-2">
              <p className="text-xs font-bold text-[#102B4E]">
                {dragging ? 'Drop document here' : 'Upload PDF, DOC, DOCX or scanned form'}
              </p>
              <p className="text-[11px] text-slate-400">Up to 15 MB per document</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Upload size={14} /> Choose Document
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Camera size={14} /> Camera Scan
              </button>
              {allowLibraryPicker && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setPickerOpen(true)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-[#083D91] text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <FolderOpen size={14} /> Library
                </button>
              )}
            </div>
          </div>
        )}

        {uploading && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#083D91]">
              <span>Uploading document...</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-150 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium',
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          )}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 size={14} className="shrink-0" />
          ) : (
            <AlertCircle size={14} className="shrink-0" />
          )}
          <span className="truncate flex-1">{statusMsg.text}</span>
        </div>
      )}

      {allowUrlInput && (
        <div>
          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            className="text-[11px] font-semibold text-slate-400 hover:text-[#083D91] inline-flex items-center gap-1 cursor-pointer"
          >
            <Link2 size={12} /> {showUrlInput ? 'Hide URL input' : 'Or enter document URL manually'}
          </button>
          {showUrlInput && (
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setStatusMsg(null);
                onChange(e.target.value);
              }}
              placeholder="https://.../document.pdf or /api/media/..."
              className="mt-1.5 w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-teal-500"
            />
          )}
        </div>
      )}

      {helperText && <p className="text-[11px] text-slate-400">{helperText}</p>}

      {allowLibraryPicker && (
        <MediaPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            setStatusMsg(null);
            onChange(url);
          }}
          filterType="all"
        />
      )}
    </div>
  );
}
