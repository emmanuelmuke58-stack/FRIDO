import React from 'react';
import {
  Upload,
  Camera,
  Image as ImageIcon,
  Crop,
  Trash2,
  Link2,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  IMAGE_ACCEPT,
  FAVICON_ACCEPT,
  UploadedMediaResult,
  uploadMediaFile,
  validateUploadFile,
  deleteAssetByUrl,
  extractMediaAssetId,
  formatFileSize,
  isAnimatedGif,
  isIcoLikeFile,
} from '../../lib/mediaUpload';
import { ImageCropModal, CropAspectPreset } from './ImageCropModal';
import { MediaPickerModal } from './MediaPickerModal';

export interface ImageUploadFieldProps {
  value?: string;
  onChange: (url: string, meta?: UploadedMediaResult) => void;
  label?: string;
  helperText?: string;
  kind?: 'image' | 'avatar' | 'favicon';
  aspectHint?: CropAspectPreset;
  enableCrop?: boolean;
  cameraFacing?: 'environment' | 'user';
  allowLibraryPicker?: boolean;
  allowUrlInput?: boolean;
  registerMedia?: boolean;
  maxDimension?: number;
  previewClassName?: string;
  className?: string;
}

export function ImageUploadField({
  value = '',
  onChange,
  label,
  helperText,
  kind = 'image',
  aspectHint = '16:9',
  enableCrop,
  cameraFacing = 'environment',
  allowLibraryPicker = true,
  allowUrlInput = true,
  registerMedia = true,
  maxDimension,
  previewClassName,
  className,
}: ImageUploadFieldProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const sessionUploadedUrlRef = React.useRef<string | null>(null);

  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [statusMsg, setStatusMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showUrlInput, setShowUrlInput] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);

  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSource, setCropSource] = React.useState<File | string | null>(null);
  const [cropFileName, setCropFileName] = React.useState('image.jpg');

  const [pickerOpen, setPickerOpen] = React.useState(false);

  const canCrop = enableCrop ?? (kind !== 'favicon');
  const acceptAttr = kind === 'favicon' ? FAVICON_ACCEPT : IMAGE_ACCEPT;

  React.useEffect(() => {
    setImgError(false);
  }, [value]);

  const performUpload = async (
    params: { file?: File; croppedBlob?: Blob; name?: string; replaceAssetId?: string | null }
  ) => {
    setUploading(true);
    setProgress(8);
    setStatusMsg(null);

    try {
      const previousSessionUrl = sessionUploadedUrlRef.current;
      const res = await uploadMediaFile({
        file: params.file,
        croppedBlob: params.croppedBlob,
        name: params.name,
        kind,
        maxDimension,
        registerMedia,
        replaceAssetId: params.replaceAssetId || null,
        onProgress: (pct) => setProgress(pct),
      });

      // Clean up temporary unsaved upload from the same editing session if replaced by a new assetId
      if (
        previousSessionUrl &&
        previousSessionUrl !== res.url &&
        extractMediaAssetId(previousSessionUrl) !== res.assetId
      ) {
        deleteAssetByUrl(previousSessionUrl).catch(() => {});
      }

      sessionUploadedUrlRef.current = res.url;
      setImgError(false);
      onChange(res.url, res);
      setStatusMsg({
        type: 'success',
        text: `Uploaded ${res.name} (${formatFileSize(res.size)})`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err?.message || 'Upload failed. Please try again.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChosen = async (file: File | undefined | null) => {
    if (!file) return;
    const err = validateUploadFile(file, kind);
    if (err) {
      setStatusMsg({ type: 'error', text: err });
      return;
    }

    // Animated GIFs and ICO favicons should upload directly to preserve animation / icon headers
    const animated = await isAnimatedGif(file);
    if (animated || isIcoLikeFile(file)) {
      await performUpload({ file });
      return;
    }

    await performUpload({ file });
  };

  const handleOpenCropForExisting = () => {
    if (!value) return;
    setCropSource(value);
    setCropFileName(value.split('/').pop()?.split('?')[0] || 'image.jpg');
    setCropOpen(true);
  };

  const handleCropConfirmed = async (result: {
    blob: Blob;
    fileName: string;
    width: number;
    height: number;
  }) => {
    setCropOpen(false);
    const ownedSessionAssetId =
      sessionUploadedUrlRef.current === value ? extractMediaAssetId(value) : null;
    await performUpload({
      croppedBlob: result.blob,
      name: result.fileName,
      replaceAssetId: ownedSessionAssetId,
    });
  };

  const handleRemove = async () => {
    const ownedSessionUrl = sessionUploadedUrlRef.current;
    if (ownedSessionUrl && ownedSessionUrl === value) {
      await deleteAssetByUrl(ownedSessionUrl).catch(() => {});
      sessionUploadedUrlRef.current = null;
    }
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

  const isLogoOrFavicon = kind === 'favicon' || aspectHint === 'logo';
  const isAvatar = kind === 'avatar';

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

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleFileChosen(f);
        }}
      />
      {kind !== 'favicon' && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture={cameraFacing}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            handleFileChosen(f);
          }}
        />
      )}

      {/* Dropzone & Preview */}
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
            <div
              className={cn(
                'relative overflow-hidden border border-slate-200 bg-white flex items-center justify-center',
                isAvatar
                  ? 'w-24 h-24 rounded-full mx-auto'
                  : kind === 'favicon'
                  ? 'w-20 h-20 rounded-xl mx-auto p-2'
                  : isLogoOrFavicon
                  ? 'h-28 rounded-xl p-3'
                  : 'aspect-video rounded-xl bg-slate-100',
                previewClassName
              )}
            >
              {!imgError ? (
                <img
                  src={value}
                  alt={label || 'Uploaded preview'}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className={cn(
                    'w-full h-full',
                    isLogoOrFavicon ? 'object-contain' : 'object-cover'
                  )}
                />
              ) : (
                <div className="text-center p-3 text-xs text-slate-400 flex flex-col items-center gap-1">
                  <ImageIcon size={20} />
                  <span>Preview unavailable</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} /> Replace
              </button>

              {kind !== 'favicon' && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Camera size={13} /> Camera
                </button>
              )}

              {canCrop && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleOpenCropForExisting}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Crop size={13} /> Crop
                </button>
              )}

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

              {!label && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleRemove}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="py-3 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
              <Upload size={20} />
            </div>
            <div className="space-y-0.5 px-2">
              <p className="text-xs font-bold text-[#102B4E]">
                {dragging ? 'Drop image here to upload' : 'Upload from device or drag & drop'}
              </p>
              <p className="text-[11px] text-slate-400">
                {kind === 'favicon'
                  ? 'ICO, PNG, WEBP, JPG (up to 15 MB)'
                  : 'JPG, PNG, WEBP, GIF, HEIC/HEIF (up to 15 MB)'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Upload size={14} /> Choose File
              </button>
              {kind !== 'favicon' && (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => cameraInputRef.current?.click()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Camera size={14} /> Camera
                </button>
              )}
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

        {/* Upload Progress Bar */}
        {uploading && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#083D91]">
              <span>Uploading image...</span>
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

      {/* Inline Feedback */}
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

      {/* Optional collapsible external URL input */}
      {allowUrlInput && (
        <div>
          <button
            type="button"
            onClick={() => setShowUrlInput((v) => !v)}
            className="text-[11px] font-semibold text-slate-400 hover:text-[#083D91] inline-flex items-center gap-1 cursor-pointer"
          >
            <Link2 size={12} /> {showUrlInput ? 'Hide URL input' : 'Or enter image URL manually'}
          </button>
          {showUrlInput && (
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setStatusMsg(null);
                onChange(e.target.value);
              }}
              placeholder="https://... or /api/media/..."
              className="mt-1.5 w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-teal-500"
            />
          )}
        </div>
      )}

      {helperText && <p className="text-[11px] text-slate-400">{helperText}</p>}

      {canCrop && (
        <ImageCropModal
          isOpen={cropOpen}
          source={cropSource}
          aspectPreset={aspectHint}
          fileName={cropFileName}
          onClose={() => setCropOpen(false)}
          onConfirm={handleCropConfirmed}
        />
      )}

      {allowLibraryPicker && (
        <MediaPickerModal
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => {
            setStatusMsg(null);
            setImgError(false);
            onChange(url);
          }}
          filterType="image"
        />
      )}
    </div>
  );
}
