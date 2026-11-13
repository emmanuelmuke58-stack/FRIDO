import React from 'react';
import { X, RotateCw, ZoomIn, ZoomOut, Check, Crop } from 'lucide-react';
import { cn } from '../../lib/utils';
import { convertHeicToJpegIfNeeded } from '../../lib/mediaUpload';

export type CropAspectPreset = 'free' | '16:9' | '1:1' | '4:3' | 'logo';

interface ImageCropModalProps {
  isOpen: boolean;
  source: File | Blob | string | null;
  aspectPreset?: CropAspectPreset;
  fileName?: string;
  onClose: () => void;
  onConfirm: (result: { blob: Blob; fileName: string; width: number; height: number }) => void;
}

const PRESET_RATIOS: Record<Exclude<CropAspectPreset, 'free' | 'logo'>, number> = {
  '16:9': 16 / 9,
  '1:1': 1,
  '4:3': 4 / 3,
};

export function ImageCropModal({
  isOpen,
  source,
  aspectPreset = '16:9',
  fileName = 'cropped-image.jpg',
  onClose,
  onConfirm,
}: ImageCropModalProps) {
  const [loadedImg, setLoadedImg] = React.useState<HTMLImageElement | null>(null);
  const [loadingImg, setLoadingImg] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [activeAspect, setActiveAspect] = React.useState<CropAspectPreset>(aspectPreset);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0); // 0, 90, 180, 270
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragStartRef = React.useRef({ clientX: 0, clientY: 0, origX: 0, origY: 0 });
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    setActiveAspect(aspectPreset);
  }, [aspectPreset, isOpen]);

  React.useEffect(() => {
    if (!isOpen || !source) {
      setLoadedImg(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    let objectUrlToRevoke: string | null = null;
    setLoadingImg(true);
    setLoadError(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });

    (async () => {
      try {
        let imgSrc = '';
        if (typeof source === 'string') {
          imgSrc = source;
        } else {
          const workingBlob =
            source instanceof File ? await convertHeicToJpegIfNeeded(source) : source;
          objectUrlToRevoke = URL.createObjectURL(workingBlob);
          imgSrc = objectUrlToRevoke;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!cancelled) {
            setLoadedImg(img);
            setLoadingImg(false);
          }
        };
        img.onerror = () => {
          if (!cancelled) {
            setLoadError('Unable to load image for cropping. External CORS restrictions may apply.');
            setLoadingImg(false);
          }
        };
        img.src = imgSrc;
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to prepare image for crop.');
          setLoadingImg(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [isOpen, source]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const computeCanvasDimensions = React.useCallback(() => {
    if (!loadedImg) return { width: 640, height: 360 };
    const isRotatedOdd = rotation % 180 !== 0;
    const naturalW = isRotatedOdd ? loadedImg.naturalHeight : loadedImg.naturalWidth;
    const naturalH = isRotatedOdd ? loadedImg.naturalWidth : loadedImg.naturalHeight;

    const ratio =
      activeAspect === 'free' || activeAspect === 'logo'
        ? naturalW / Math.max(1, naturalH)
        : PRESET_RATIOS[activeAspect];

    const previewMaxW = 640;
    const previewMaxH = 400;
    let width = previewMaxW;
    let height = Math.round(width / ratio);
    if (height > previewMaxH) {
      height = previewMaxH;
      width = Math.round(height * ratio);
    }
    return { width: Math.max(160, width), height: Math.max(160, height) };
  }, [loadedImg, activeAspect, rotation]);

  const drawPreview = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loadedImg) return;
    const { width, height } = computeCanvasDimensions();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    if (activeAspect === 'logo') {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);
    }

    const isRotatedOdd = rotation % 180 !== 0;
    const rotW = isRotatedOdd ? loadedImg.naturalHeight : loadedImg.naturalWidth;
    const rotH = isRotatedOdd ? loadedImg.naturalWidth : loadedImg.naturalHeight;

    const baseScale =
      activeAspect === 'logo'
        ? Math.min(width / rotW, height / rotH)
        : Math.max(width / rotW, height / rotH);
    const drawScale = baseScale * zoom;

    ctx.save();
    ctx.translate(width / 2 + offset.x, height / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(drawScale, drawScale);
    ctx.drawImage(
      loadedImg,
      -loadedImg.naturalWidth / 2,
      -loadedImg.naturalHeight / 2
    );
    ctx.restore();

    // Subtle rule-of-thirds overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((width * 2) / 3, 0);
    ctx.lineTo((width * 2) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (height * 2) / 3);
    ctx.lineTo(width, (height * 2) / 3);
    ctx.stroke();
  }, [loadedImg, computeCanvasDimensions, zoom, rotation, offset, activeAspect]);

  React.useEffect(() => {
    drawPreview();
  }, [drawPreview]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    setDragging(true);
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origX: offset.x,
      origY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setOffset({
      x: dragStartRef.current.origX + (e.clientX - dragStartRef.current.clientX),
      y: dragStartRef.current.origY + (e.clientY - dragStartRef.current.clientY),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragging) {
      setDragging(false);
      try {
        (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleApplyCrop = async () => {
    if (!loadedImg) return;
    const previewDims = computeCanvasDimensions();
    const outScale = Math.min(2.5, Math.max(1.5, 1600 / Math.max(previewDims.width, previewDims.height)));
    const outW = Math.round(previewDims.width * outScale);
    const outH = Math.round(previewDims.height * outScale);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    const isRotatedOdd = rotation % 180 !== 0;
    const rotW = isRotatedOdd ? loadedImg.naturalHeight : loadedImg.naturalWidth;
    const rotH = isRotatedOdd ? loadedImg.naturalWidth : loadedImg.naturalHeight;
    const baseScale =
      activeAspect === 'logo'
        ? Math.min(outW / rotW, outH / rotH)
        : Math.max(outW / rotW, outH / rotH);
    const drawScale = baseScale * zoom;

    const isPng = fileName.toLowerCase().endsWith('.png') || activeAspect === 'logo';
    if (!isPng) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, outW, outH);
    }

    ctx.save();
    ctx.translate(outW / 2 + offset.x * outScale, outH / 2 + offset.y * outScale);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(drawScale, drawScale);
    ctx.drawImage(
      loadedImg,
      -loadedImg.naturalWidth / 2,
      -loadedImg.naturalHeight / 2
    );
    ctx.restore();

    const outMime = isPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob>((resolve, reject) => {
      outCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed exporting cropped image.'))),
        outMime,
        0.9
      );
    });

    const baseName = fileName.replace(/\.[a-z0-9]+$/i, '') || 'cropped';
    onConfirm({
      blob,
      fileName: `${baseName}.${isPng ? 'png' : 'jpg'}`,
      width: outW,
      height: outH,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop and adjust image"
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Crop size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#102B4E] truncate">Crop, Zoom & Rotate</h3>
              <p className="text-xs text-slate-400">Drag image to reposition within the frame.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cropper"
            className="min-w-[40px] min-h-[40px] rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {loadingImg ? (
            <div className="h-64 bg-slate-100 rounded-2xl flex items-center justify-center text-sm text-slate-500 animate-pulse">
              Preparing image preview...
            </div>
          ) : loadError ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              {loadError}
            </div>
          ) : (
            <div className="flex justify-center bg-slate-900 rounded-2xl p-3 overflow-hidden">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="max-w-full max-h-[340px] rounded-xl cursor-grab active:cursor-grabbing touch-none shadow-inner"
              />
            </div>
          )}

          {/* Controls */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Frame Aspect
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(['16:9', '4:3', '1:1', 'free'] as CropAspectPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setActiveAspect(preset);
                      setOffset({ x: 0, y: 0 });
                    }}
                    className={cn(
                      'min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors',
                      activeAspect === preset
                        ? 'bg-[#083D91] text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-500'
                    )}
                  >
                    {preset === 'free' ? 'Original' : preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <div className="flex items-center gap-2.5 flex-1">
                <ZoomOut size={16} className="text-slate-400 shrink-0" />
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  aria-label="Zoom image"
                  className="flex-1 accent-teal-600"
                />
                <ZoomIn size={16} className="text-slate-400 shrink-0" />
                <span className="text-xs font-bold tabular-nums text-slate-600 w-10 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="min-h-[40px] px-4 py-2 bg-white border border-slate-200 hover:border-[#083D91] rounded-xl text-xs font-bold text-[#102B4E] inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <RotateCw size={14} /> Rotate 90°
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 bg-slate-50/70">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loadingImg || Boolean(loadError) || !loadedImg}
            onClick={handleApplyCrop}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check size={16} /> Apply & Upload
          </button>
        </div>
      </div>
    </div>
  );
}
