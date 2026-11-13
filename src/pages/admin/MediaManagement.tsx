import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { CategoryItem, MediaItem, NewsItem, Opportunity, WebPage } from '../../types';
import {
  Plus, Trash2, Copy, ExternalLink, Search, X,
  Film, FileText, File, AlertTriangle, Upload, Camera, RefreshCw
} from 'lucide-react';
import { logActivity, permanentDeleteRecord, bulkPermanentDeleteRecords } from '../../lib/services';
import { cn, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import { useAdminAuth } from './AdminLayout';
import { canDeleteOperationalRecord } from '../../lib/permissions';
import { useSettings } from '../../lib/SettingsContext';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import {
  uploadMediaFile,
  deleteAssetByUrl,
  extractMediaAssetId,
  formatFileSize,
} from '../../lib/mediaUpload';

interface MediaReference {
  collection: 'news'| 'opportunities'| 'pages'| 'categories'| 'settings';
  id: string;
  title: string;
  field: string;
}

export function MediaManagement() {
  const { userProfile } = useAdminAuth();
  const { settings, updateSettings } = useSettings();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setAdding] = useState(false);
  const [newMedia, setNewMedia] = useState<{ url: string; name: string; mediaType: MediaItem['mediaType'] }>({
    url: '',
    name: '',
    mediaType: 'image',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Dependency checking state
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [refs, setRefs] = useState<MediaReference[]>([]);
  const [refResolution, setRefResolution] = useState<'remove'| 'replace'>('remove');
  const [replacementUrl, setReplacementUrl] = useState('');
  const [scanningRefs, setScanningRefs] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Direct device/camera upload state
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadQueueLabel, setUploadQueueLabel] = useState('');
  const [draggingDropzone, setDraggingDropzone] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetRef = useRef<MediaItem | null>(null);

  const allowDelete = canDeleteOperationalRecord(userProfile);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem)));
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load media library.'});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const findMediaReferences = async (url: string): Promise<MediaReference[]> => {
    const found: MediaReference[] = [];
    const [newsSnap, oppsSnap, pagesSnap, catsSnap] = await Promise.all([
      getDocs(collection(db, 'news')),
      getDocs(collection(db, 'opportunities')),
      getDocs(collection(db, 'pages')),
      getDocs(collection(db, 'categories')),
    ]);

    newsSnap.docs.forEach(d => {
      const n = d.data() as NewsItem;
      if (n.status === 'deleted') return;
      if (n.imageUrl === url || (n.content && n.content.includes(url))) {
        found.push({
          collection: 'news',
          id: d.id,
          title: n.headline,
          field: n.imageUrl === url ? 'imageUrl': 'content',
        });
      }
    });

    oppsSnap.docs.forEach(d => {
      const o = d.data() as Opportunity;
      if (o.status === 'deleted') return;
      const inGallery = Array.isArray(o.galleryImages) && o.galleryImages.includes(url);
      if (
        o.organizationLogo === url ||
        o.coverImageUrl === url ||
        inGallery ||
        o.downloadUrl === url ||
        (o.description && o.description.includes(url))
      ) {
        found.push({
          collection: 'opportunities',
          id: d.id,
          title: o.title,
          field:
            o.organizationLogo === url
              ? 'organizationLogo'
              : o.coverImageUrl === url
              ? 'coverImageUrl'
              : inGallery
              ? 'galleryImages'
              : o.downloadUrl === url
              ? 'downloadUrl'
              : 'description',
        });
      }
    });

    pagesSnap.docs.forEach(d => {
      const p = d.data() as WebPage;
      if (p.status === 'deleted') return;
      if (p.imageUrl === url || (p.content && p.content.includes(url))) {
        found.push({
          collection: 'pages',
          id: d.id,
          title: p.title,
          field: p.imageUrl === url ? 'imageUrl' : 'content',
        });
      }
    });

    catsSnap.docs.forEach(d => {
      const c = d.data() as CategoryItem;
      if (c.status === 'deleted') return;
      if (c.imageUrl === url || c.thumbnailUrl === url) {
        found.push({
          collection: 'categories',
          id: d.id,
          title: c.name,
          field: c.imageUrl === url ? 'imageUrl' : 'thumbnailUrl',
        });
      }
    });

    const promo = settings.homepage?.promoBanners;
    const inPromos =
      promo?.education?.image === url ||
      promo?.tenders?.image === url ||
      promo?.cta?.image === url;

    if (
      settings.logoUrl === url ||
      settings.faviconUrl === url ||
      settings.heroSlides.some(s => s.image === url) ||
      inPromos
    ) {
      found.push({ collection: 'settings', id: 'global', title: 'Global Website Settings / Hero Slides / Banners', field: 'settings'});
    }

    return found;
  };

  const initiateSingleDelete = async (item: MediaItem) => {
    setDeleteTarget(item);
    setRefs([]);
    setRefResolution('remove');
    setReplacementUrl('');
    setScanningRefs(true);
    try {
      const found = await findMediaReferences(item.url);
      setRefs(found);
    } finally {
      setScanningRefs(false);
    }
  };

  const resolveReferencesAndDelete = async (item: MediaItem, references: MediaReference[], mode: 'remove'| 'replace', newUrl: string, reason?: string) => {
    const safeNewUrl = mode === 'replace'? newUrl.trim() : '';

    if (references.length > 0) {
      const batch = writeBatch(db);
      const [newsSnap, oppsSnap, pagesSnap, catsSnap] = await Promise.all([
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'opportunities')),
        getDocs(collection(db, 'pages')),
        getDocs(collection(db, 'categories')),
      ]);

      newsSnap.docs.forEach(d => {
        const data = d.data();
        const updates: Record<string, any> = {};
        if (data.imageUrl === item.url) updates.imageUrl = safeNewUrl;
        if (typeof data.content === 'string'&& data.content.includes(item.url)) {
          updates.content = safeNewUrl
            ? data.content.split(item.url).join(safeNewUrl)
            : data.content.split(item.url).join('');
        }
        if (Object.keys(updates).length > 0) batch.update(doc(db, 'news', d.id), updates);
      });

      oppsSnap.docs.forEach(d => {
        const data = d.data();
        const updates: Record<string, any> = {};
        if (data.organizationLogo === item.url) updates.organizationLogo = safeNewUrl;
        if (data.coverImageUrl === item.url) updates.coverImageUrl = safeNewUrl;
        if (Array.isArray(data.galleryImages) && data.galleryImages.includes(item.url)) {
          updates.galleryImages = safeNewUrl
            ? data.galleryImages.map((u: string) => (u === item.url ? safeNewUrl : u))
            : data.galleryImages.filter((u: string) => u !== item.url);
        }
        if (data.downloadUrl === item.url) updates.downloadUrl = safeNewUrl;
        if (typeof data.description === 'string'&& data.description.includes(item.url)) {
          updates.description = data.description.split(item.url).join(safeNewUrl);
        }
        if (Object.keys(updates).length > 0) batch.update(doc(db, 'opportunities', d.id), updates);
      });

      pagesSnap.docs.forEach(d => {
        const data = d.data();
        const updates: Record<string, any> = {};
        if (data.imageUrl === item.url) updates.imageUrl = safeNewUrl;
        if (typeof data.content === 'string'&& data.content.includes(item.url)) {
          updates.content = data.content.split(item.url).join(safeNewUrl);
        }
        if (Object.keys(updates).length > 0) batch.update(doc(db, 'pages', d.id), updates);
      });

      catsSnap.docs.forEach(d => {
        const data = d.data();
        const updates: Record<string, any> = {};
        if (data.imageUrl === item.url) updates.imageUrl = safeNewUrl;
        if (data.thumbnailUrl === item.url) updates.thumbnailUrl = safeNewUrl;
        if (Object.keys(updates).length > 0) batch.update(doc(db, 'categories', d.id), updates);
      });

      await batch.commit();

      // Update settings if referenced there
      const settingsRef = references.some(r => r.collection === 'settings');
      if (settingsRef) {
        const currentPromos = settings.homepage?.promoBanners;
        const updatedPromos = currentPromos
          ? {
              education: currentPromos.education.image === item.url ? { ...currentPromos.education, image: safeNewUrl } : currentPromos.education,
              tenders: currentPromos.tenders.image === item.url ? { ...currentPromos.tenders, image: safeNewUrl } : currentPromos.tenders,
              cta: currentPromos.cta.image === item.url ? { ...currentPromos.cta, image: safeNewUrl } : currentPromos.cta,
            }
          : undefined;
        const updatedSettings = {
          ...settings,
          logoUrl: settings.logoUrl === item.url ? (safeNewUrl || settings.logoUrl) : settings.logoUrl,
          faviconUrl: settings.faviconUrl === item.url ? safeNewUrl : settings.faviconUrl,
          heroSlides: settings.heroSlides.map(s => (s.image === item.url ? { ...s, image: safeNewUrl } : s)),
          homepage: updatedPromos
            ? { ...settings.homepage, promoBanners: updatedPromos }
            : settings.homepage,
        };
        await updateSettings(updatedSettings);
      }
    }

    await permanentDeleteRecord('media', item.id, item.name, 'media', reason);
    await deleteAssetByUrl(item.url).catch(() => false);
  };

  const handleConfirmSingleDelete = async (reason?: string) => {
    if (!deleteTarget) return;
    try {
      await resolveReferencesAndDelete(deleteTarget, refs, refResolution, replacementUrl, reason);
      setFeedback({
        type: 'success',
        message: refs.length > 0
          ? `Updated ${refs.length} reference(s) and deleted media "${deleteTarget.name}".`
          : `Media "${deleteTarget.name}" permanently deleted.`,
      });
      setDeleteTarget(null);
      await fetchMedia();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to delete media item.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleConfirmBulkDelete = async (reason?: string) => {
    const selected = filteredMedia.filter(m => selectedIds.has(m.id));
    const safeToDelete: MediaItem[] = [];
    const inUseSkipped: string[] = [];

    for (const item of selected) {
      const found = await findMediaReferences(item.url);
      if (found.length > 0) {
        inUseSkipped.push(`"${item.name}" (used in ${found.length} record(s) — delete individually to replace/strip URL)`);
      } else {
        safeToDelete.push(item);
      }
    }

    if (safeToDelete.length === 0) {
      const msg = 'All selected media assets are currently referenced by published content. Delete them individually to safely replace or strip references.';
      setFeedback({
        type: 'error',
        message: msg,
        details: inUseSkipped,
      });
      throw new Error(msg);
    }

    const res = await bulkPermanentDeleteRecords(
      'media',
      safeToDelete.map(m => ({ id: m.id, title: m.name })),
      'media',
      reason
    );

    for (const m of safeToDelete) {
      deleteAssetByUrl(m.url).catch(() => false);
    }

    const details = [...res.errors, ...inUseSkipped];
    setFeedback({
      type: res.failed > 0 || inUseSkipped.length > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Deleted ${res.succeeded} unused media asset(s).${inUseSkipped.length > 0 ? ` ${inUseSkipped.length} skipped (in use).` : ''}`,
      details,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete selected media assets.');
    }
    setSelectedIds(new Set());
    await fetchMedia();
  };

  const handleDirectUploadFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress(5);
    const errors: string[] = [];
    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setUploadQueueLabel(`Uploading ${i + 1} of ${files.length}: ${f.name}`);
      const isDoc =
        /\.(pdf|docx?)$/i.test(f.name) ||
        ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(
          (f.type || '').toLowerCase()
        );
      try {
        await uploadMediaFile({
          file: f,
          kind: isDoc ? 'document' : 'image',
          registerMedia: true,
          onProgress: (pct) => {
            const overall = Math.round(((i + pct / 100) / files.length) * 100);
            setUploadProgress(overall);
          },
        });
        uploadedCount++;
        await logActivity('media', 'create', `Uploaded media file: ${f.name}`);
      } catch (err: any) {
        errors.push(`${f.name}: ${err?.message || 'Upload failed'}`);
      }
    }

    setUploadingFiles(false);
    setUploadQueueLabel('');
    setUploadProgress(0);

    if (uploadedCount > 0 && errors.length === 0) {
      setFeedback({ type: 'success', message: `Successfully uploaded ${uploadedCount} file(s) to the Media Library.` });
    } else if (uploadedCount > 0) {
      setFeedback({
        type: 'warning',
        message: `Uploaded ${uploadedCount} file(s), ${errors.length} failed.`,
        details: errors,
      });
    } else {
      setFeedback({
        type: 'error',
        message: 'Failed to upload selected file(s).',
        details: errors,
      });
    }
    await fetchMedia();
  };

  const handleReplaceFileChosen = async (file: File | undefined | null) => {
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;

    const existingAssetId = target.assetId || extractMediaAssetId(target.url);
    const isDoc =
      /\.(pdf|docx?)$/i.test(file.name) ||
      ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(
        (file.type || '').toLowerCase()
      );

    setReplacingId(target.id);
    try {
      const res = await uploadMediaFile({
        file,
        kind: isDoc ? 'document' : 'image',
        name: target.name,
        registerMedia: false,
        replaceAssetId: existingAssetId || null,
      });

      await updateDoc(doc(db, 'media', target.id), {
        url: res.url,
        thumbnailUrl: res.thumbnailUrl || null,
        assetId: res.assetId,
        mediaType: res.mediaType,
        mimeType: res.mimeType,
        size: res.size,
        width: res.width || 0,
        height: res.height || 0,
        updatedAt: new Date().toISOString(),
      });

      await logActivity('media', 'edit', `Replaced file for media "${target.name}"`, target.id);
      setFeedback({ type: 'success', message: `Replaced file for "${target.name}" cleanly.` });
      await fetchMedia();
    } catch (err: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(err, 'Failed to replace media file.') });
    } finally {
      setReplacingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedia.url || !newMedia.name) return;
    try {
      await addDoc(collection(db, 'media'), {
        ...newMedia,
        createdAt: new Date().toISOString()
      });
      await logActivity('media', 'create', `Added media (${newMedia.mediaType}): ${newMedia.name}`);
      setNewMedia({ url: '', name: '', mediaType: 'image'});
      setAdding(false);
      setFeedback({ type: 'success', message: `Media "${newMedia.name}" added to library.` });
      fetchMedia();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to add media.'});
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setFeedback({ type: 'success', message: 'Media URL copied to clipboard.'});
  };

  const filteredMedia = media.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const itemType = m.mediaType || 'image';
    const matchesType = typeFilter === 'all'|| itemType === typeFilter;
    return matchesSearch && matchesType;
  });

  const renderPreview = (item: MediaItem) => {
    const t = item.mediaType || 'image';
    if (t === 'video') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white gap-2">
          <Film size={32} className="text-teal-400"/>
          <span className="text-[10px] font-bold uppercase tracking-widest">Video Asset</span>
        </div>
      );
    }
    if (t === 'pdf'|| t === 'document') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50 text-[#083D91] gap-2">
          {t === 'pdf'? <FileText size={32} /> : <File size={32} />}
          <span className="text-[10px] font-bold uppercase tracking-widest">{t.toUpperCase()}</span>
        </div>
      );
    }
    return (
      <img
        src={item.thumbnailUrl || item.url}
        alt={item.name}
        referrerPolicy="no-referrer"
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          if (item.thumbnailUrl && el.src !== item.url) {
            el.src = item.url;
          } else {
            el.style.display = 'none';
          }
        }}
        className="w-full h-full object-cover"
      />
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 sm:pb-20">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleDirectUploadFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleDirectUploadFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          handleReplaceFileChosen(f);
        }}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Media Library</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Upload images, PDFs, or documents from any device, replace files cleanly, and safely check content references before deletion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={uploadingFiles}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-blue-900/15 transition-all disabled:opacity-50"
          >
            <Upload size={18} /> Upload Files
          </button>
          <button
            type="button"
            disabled={uploadingFiles}
            onClick={() => cameraInputRef.current?.click()}
            className="min-h-[44px] bg-white border border-slate-200 hover:border-teal-500 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <Camera size={18} /> Camera
          </button>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="min-h-[44px] bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
          >
            <Plus size={18} /> Add URL
          </button>
        </div>
      </div>

      {/* Drag & Drop Direct Upload Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!draggingDropzone) setDraggingDropzone(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingDropzone(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingDropzone(false);
          if (e.dataTransfer?.files?.length) {
            handleDirectUploadFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed p-5 sm:p-6 transition-all text-center",
          draggingDropzone ? "border-teal-500 bg-teal-50/70" : "border-slate-200 bg-white"
        )}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-3 text-left">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-[#102B4E]">
                {draggingDropzone ? 'Drop files here to upload' : 'Drag & drop photos, animated GIFs, HEIC/HEIF, or PDFs/DOCX here'}
              </p>
              <p className="text-xs text-slate-400">
                Supports batch device uploads and mobile camera capture (up to 15 MB per file) with automatic thumbnail generation.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={uploadingFiles}
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto min-h-[40px] px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102B4E] text-xs font-bold shrink-0 disabled:opacity-50"
          >
            Choose from Device
          </button>
        </div>

        {uploadingFiles && (
          <div className="mt-4 max-w-2xl mx-auto space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#083D91]">
              <span className="truncate">{uploadQueueLabel || 'Uploading...'}</span>
              <span className="tabular-nums">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 transition-all duration-150 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {isAdding && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border-2 border-teal-100 shadow-xl animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center mb-5 sm:mb-6">
            <h3 className="font-bold text-lg">Add New Media Asset</h3>
            <button onClick={() => setAdding(false)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Name / Description</label>
              <input required className="w-full min-h-[44px] p-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-100" placeholder="e.g. Kigali Skyline" value={newMedia.name} onChange={e => setNewMedia({ ...newMedia, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Type</label>
              <select
                className="w-full min-h-[44px] p-3.5 bg-slate-50 rounded-2xl text-sm border border-slate-100" value={newMedia.mediaType}
                onChange={e => setNewMedia({ ...newMedia, mediaType: e.target.value as MediaItem['mediaType'] })}
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="pdf">PDF Document</option>
                <option value="document">Attachment / Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct File / Image URL</label>
              <input required className="w-full min-h-[44px] p-3.5 bg-slate-50 rounded-2xl text-sm font-mono border border-slate-100" placeholder="https://..." value={newMedia.url} onChange={e => setNewMedia({ ...newMedia, url: e.target.value })} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button type="submit" className="w-full sm:w-auto min-h-[44px] bg-[#083D91] text-white px-8 py-3 rounded-xl text-sm font-bold">Save Media</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search media..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'image', 'video', 'pdf', 'document'].map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setSelectedIds(new Set()); }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                typeFilter === t ? "bg-[#083D91] text-white": "bg-slate-50 text-slate-500 hover:bg-slate-100")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={filteredMedia.length}
        totalFilteredCount={filteredMedia.length}
        allFilteredSelected={selectedIds.size === filteredMedia.length && filteredMedia.length > 0}
        onSelectPage={(checked) => setSelectedIds(checked ? new Set(filteredMedia.map(m => m.id)) : new Set())}
        onSelectAllFiltered={() => setSelectedIds(new Set(filteredMedia.map(m => m.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        canDelete={allowDelete}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
        {filteredMedia.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="aspect-square bg-slate-50 relative overflow-hidden">
              {renderPreview(item)}
              <div className="absolute top-2.5 left-2.5 z-10">
                <input
                  type="checkbox" checked={selectedIds.has(item.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    setSelectedIds(next);
                  }}
                  className="w-4 h-4 rounded border-white shadow text-[#083D91]"/>
              </div>
              <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button onClick={() => copyUrl(item.url)} className="min-w-[36px] min-h-[36px] p-2 bg-white/95 backdrop-blur rounded-lg text-slate-900 shadow-lg hover:scale-105 transition-transform flex items-center justify-center" title="Copy URL"><Copy size={16} /></button>
                <a href={item.url} target="_blank" rel="noreferrer" className="min-w-[36px] min-h-[36px] p-2 bg-white/95 backdrop-blur rounded-lg text-slate-900 shadow-lg hover:scale-105 transition-transform flex items-center justify-center" title="Open"><ExternalLink size={16} /></a>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-bold text-slate-900 truncate mb-1">{item.name}</p>
              <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                <span>{safeFormatDate(item.createdAt, 'MMM dd, yyyy')}</span>
                <span className="truncate">
                  {item.width && item.height ? `${item.width}×${item.height}` : ''}
                  {item.width && item.height && item.size ? ' · ' : ''}
                  {item.size ? formatFileSize(item.size) : ''}
                </span>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-2 pt-2.5">
                <button
                  type="button"
                  disabled={replacingId === item.id}
                  onClick={() => {
                    replaceTargetRef.current = item;
                    replaceInputRef.current?.click();
                  }}
                  className="min-h-[34px] px-2.5 py-1 text-[11px] font-bold text-[#083D91] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={12} className={replacingId === item.id ? 'animate-spin' : ''} />
                  {replacingId === item.id ? 'Replacing...' : 'Replace'}
                </button>
                {allowDelete && (
                  <button
                    onClick={() => initiateSingleDelete(item)}
                    className="min-h-[34px] px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                    <Trash2 size={12} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && filteredMedia.length === 0 && (
        <div className="p-20 text-center text-slate-400 italic">No media found.</div>
      )}

      {/* Dependency-Aware Media Delete Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmSingleDelete}
        title="Delete Media Asset?" itemName={deleteTarget?.name}
        description={
          scanningRefs
            ? 'Checking whether this media asset is used by published articles, opportunities, or website pages...': refs.length > 0
            ? `This file is currently referenced by ${refs.length} active record(s). Choose how to safely handle those references before deleting.`
            : 'No active content references this file. Deleting it will permanently remove it from the Media Library.'}
        confirmLabel={refs.length > 0 ? (refResolution === 'replace'? 'Replace URL & Delete': 'Strip References & Delete') : 'Delete Media'}
        isPermanent
        disableConfirm={scanningRefs || (refs.length > 0 && refResolution === 'replace'&& !replacementUrl.trim())}
        extraContent={
          !scanningRefs && refs.length > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 text-xs">
              <div className="flex items-start gap-2 text-amber-800 font-bold">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600"/>
                <span>Referenced in {refs.length} place(s):</span>
              </div>
              <ul className="space-y-1 text-amber-900 list-disc list-inside max-h-24 overflow-y-auto">
                {refs.map((r, idx) => (
                  <li key={idx} className="truncate">
                    <span className="uppercase font-bold text-[10px]">[{r.collection}]</span> {r.title}
                  </li>
                ))}
              </ul>
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio" checked={refResolution === 'remove'}
                    onChange={() => setRefResolution('remove')}
                  />
                  Safely clear broken references from referencing records
                </label>
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="radio" checked={refResolution === 'replace'}
                    onChange={() => setRefResolution('replace')}
                  />
                  Replace with another Media URL across all references
                </label>
                {refResolution === 'replace'&& (
                  <input
                    type="text" placeholder="https://... replacement asset URL" value={replacementUrl}
                    onChange={e => setReplacementUrl(e.target.value)}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs font-mono"/>
                )}
              </div>
            </div>
          ) : undefined
        }
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={`Delete ${selectedIds.size} Selected Media Files?`}
        description="Unused selected media files will be permanently deleted. Any files currently referenced by published content will be skipped so you can replace or clear their references safely." confirmLabel="Delete Unused Media" isPermanent
      />
    </div>
  );
}
