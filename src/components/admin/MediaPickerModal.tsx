import React, { useEffect, useState, useRef } from 'react';
import { collection, getDocs, orderBy, query, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  X, Search, Image as ImageIcon, Plus, Check, Upload, Camera,
  Link2, FileText, File, Film
} from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import {
  IMAGE_ACCEPT,
  DOCUMENT_ACCEPT,
  uploadMediaFile,
  validateUploadFile,
  formatFileSize,
} from '../../lib/mediaUpload';

interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
  mediaType?: 'image' | 'video' | 'pdf' | 'document';
  size?: number;
  createdAt: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  filterType?: 'all' | 'image' | 'pdf' | 'document';
}

export function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  filterType = 'image',
}: MediaPickerModalProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<string>(filterType);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem)));
    } catch (e) {
      console.error('Failed to load media library:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveType(filterType);
      setErrorMsg(null);
      fetchMedia();
    }
  }, [isOpen, filterType]);

  const handleUploadFile = async (file: File | undefined | null) => {
    if (!file) return;
    const isImageOnly = filterType === 'image';
    const err = validateUploadFile(file, isImageOnly ? 'image' : 'document');
    if (err) {
      setErrorMsg(err);
      return;
    }

    setUploading(true);
    setUploadPct(8);
    setErrorMsg(null);
    try {
      const res = await uploadMediaFile({
        file,
        kind: isImageOnly ? 'image' : 'document',
        registerMedia: true,
        onProgress: (pct) => setUploadPct(pct),
      });
      onSelect(res.url);
      onClose();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    setErrorMsg(null);
    try {
      await addDoc(collection(db, 'media'), {
        name: newName.trim(),
        url: newUrl.trim(),
        mediaType: filterType === 'all' ? 'document' : 'image',
        createdAt: new Date().toISOString()
      });
      await logActivity('settings', 'create', `Added media: ${newName.trim()}`);
      onSelect(newUrl.trim());
      setNewName('');
      setNewUrl('');
      setShowUrlForm(false);
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to add media item. Verify you have admin permissions.');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const filtered = media.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.url.toLowerCase().includes(search.toLowerCase());
    const t = m.mediaType || 'image';
    const matchesType =
      activeType === 'all' ||
      t === activeType ||
      (activeType === 'document' && (t === 'document' || t === 'pdf'));
    return matchesSearch && matchesType;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <ImageIcon size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-[#102B4E]">Upload & Media Library</h3>
              <p className="text-xs text-slate-400">Upload directly from your device/camera or select a saved asset.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="min-w-[40px] min-h-[40px] p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 flex items-center justify-center flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={filterType === 'image' ? IMAGE_ACCEPT : DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            handleUploadFile(f);
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
            handleUploadFile(f);
          }}
        />

        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 space-y-3">
          {/* Device Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              handleUploadFile(e.dataTransfer?.files?.[0]);
            }}
            className={cn(
              'rounded-2xl border-2 border-dashed p-3.5 sm:p-4 bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3',
              dragging ? 'border-teal-500 bg-teal-50/40' : 'border-slate-200'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Upload size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-[#102B4E]">
                  {dragging ? 'Drop file to upload & insert' : 'Upload directly from device or drag & drop'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {filterType === 'image'
                    ? 'JPG, PNG, WEBP, GIF, HEIC/HEIF up to 15 MB'
                    : 'JPG, PNG, WEBP, PDF, DOC, DOCX up to 15 MB'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Upload size={14} /> Upload File
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102B4E] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Camera size={14} /> Camera
              </button>
              <button
                type="button"
                onClick={() => setShowUrlForm((v) => !v)}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-teal-500 text-slate-600 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Link2 size={14} /> URL
              </button>
            </div>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-[#083D91]">
                <span>Uploading and optimizing...</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-teal-500 transition-all duration-150" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}

          {showUrlForm && (
            <form onSubmit={handleQuickAdd} className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <input
                type="text" placeholder="Asset label" className="md:col-span-4 min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500" value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <input
                type="url" placeholder="Paste asset URL (https://...)" className="md:col-span-6 min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-500" value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
              />
              <button
                type="submit" disabled={adding || !newName.trim() || !newUrl.trim()}
                className="md:col-span-2 min-h-[42px] bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Plus size={15} /> Save & Use
              </button>
            </form>
          )}

          {errorMsg && <p className="text-xs font-medium text-red-600">{errorMsg}</p>}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text" placeholder="Search saved media..." className="w-full min-h-[42px] pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500" value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {(['all', 'image', 'pdf', 'document'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveType(t)}
                  className={cn(
                    'min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-colors',
                    activeType === t
                      ? 'bg-[#083D91] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-500'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-12 sm:py-16 text-center text-slate-400">Loading media library...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 sm:py-16 text-center text-slate-400 italic">
              No matching media items yet. Upload a file above to get started.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map(item => {
                const t = item.mediaType || 'image';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.url);
                      onClose();
                    }}
                    className="group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-teal-500 hover:shadow-lg transition-all flex flex-col">
                    <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                      {t === 'pdf' ? (
                        <div className="flex flex-col items-center gap-1 text-[#083D91]">
                          <FileText size={28} />
                          <span className="text-[10px] font-bold uppercase">PDF</span>
                        </div>
                      ) : t === 'document' ? (
                        <div className="flex flex-col items-center gap-1 text-slate-600">
                          <File size={28} />
                          <span className="text-[10px] font-bold uppercase">DOC</span>
                        </div>
                      ) : t === 'video' ? (
                        <div className="flex flex-col items-center gap-1 text-teal-600">
                          <Film size={28} />
                          <span className="text-[10px] font-bold uppercase">VIDEO</span>
                        </div>
                      ) : (
                        <img
                          src={item.thumbnailUrl || item.url}
                          alt={item.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      <div className="absolute inset-0 bg-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow">
                          <Check size={14} /> Select
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 sm:p-3 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      {item.size ? (
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(item.size)}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

