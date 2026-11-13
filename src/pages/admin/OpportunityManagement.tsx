import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, doc, updateDoc, where } from 'firebase/firestore';
import { Opportunity } from '../../types';
import {
  Plus, Trash2, Edit, Search, Save, Globe, Clock, ChevronLeft,
  MapPin, Building2, Link as LinkIcon, DollarSign, AlertCircle, Eye, EyeOff, RotateCcw,
  Image as ImageIcon, Upload, Camera, ArrowLeft, ArrowRight, X
} from 'lucide-react';
import {
  logActivity,
  softDeleteRecord,
  bulkSoftDeleteRecords,
  permanentDeleteRecord,
  bulkPermanentDeleteRecords,
  restoreRecord,
} from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { FileUploadField } from '../../components/admin/FileUploadField';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { canSoftDeleteContent, canPermanentDelete, canRestoreContent } from '../../lib/permissions';
import { useAdminAuth } from './AdminLayout';
import { cn, generateSlug, safeDate, safeFormatDate, extractErrorMessage, stripUndefined } from '../../lib/utils';
import { invalidatePublicCache } from '../../lib/publicData';
import { IMAGE_ACCEPT, uploadMediaFile, validateUploadFile } from '../../lib/mediaUpload';
import { isBefore } from 'date-fns';
import { useLocation, NavLink } from 'react-router-dom';

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Jobs: ['Government', 'Private Sector', 'NGO', 'International', 'General'],
  Scholarships: ['Local', 'International', 'Undergraduate', "Master's", 'PhD'],
  Tenders: ['Government', 'Private Sector', 'NGO'],
  Others: ['Internships', 'Fellowships', 'Grants', 'Training', 'Conferences', 'Workshops']
};

const PAGE_SIZE = 12;

export function OpportunityManagement() {
  const { userProfile } = useAdminAuth();
  const location = useLocation();
  const pathCategory = React.useMemo(() => {
    const path = location.pathname.split('/').pop();
    if (path === 'jobs') return 'Jobs';
    if (path === 'scholarships') return 'Scholarships';
    if (path === 'tenders') return 'Tenders';
    return 'Others';
  }, [location.pathname]) as Opportunity['category'];

  const [allOpps, setAllOpps] = React.useState<Opportunity[]>([]);
  const [customSubCats, setCustomSubCats] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list'| 'edit'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all'| 'active'| 'draft'| 'expired'| 'deleted'>('all');
  const [currentOpp, setCurrentOpp] = React.useState<Partial<Opportunity>>({});

  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<Opportunity | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = React.useState<Opportunity | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null);
  const [galleryUploading, setGalleryUploading] = React.useState(false);
  const galleryFileRef = React.useRef<HTMLInputElement | null>(null);
  const galleryCamRef = React.useRef<HTMLInputElement | null>(null);

  const allowPermanent = canPermanentDelete(userProfile);
  const allowRestore = canRestoreContent(userProfile);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, 'opportunities'), where('category', '==', pathCategory))),
        getDocs(query(collection(db, 'categories'), where('module', '==', pathCategory))),
      ]);
      setAllOpps(
        oppSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Opportunity))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
      setCustomSubCats(
        catSnap.docs
          .map(d => d.data())
          .filter(c => c.status !== 'deleted')
          .map(c => c.name as string)
      );
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: `Failed to load ${pathCategory.toLowerCase()}.` });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setEditorMode('list');
    setSelectedIds(new Set());
    setCurrentPage(1);
    setStatusFilter('all');
    fetchData();
  }, [pathCategory]);

  const activeOpps = React.useMemo(() => allOpps.filter(o => o.status !== 'deleted'), [allOpps]);
  const deletedOpps = React.useMemo(() => allOpps.filter(o => o.status === 'deleted'), [allOpps]);

  const handleSave = async (status: 'active'| 'draft'= 'active') => {
    if (!currentOpp.title?.trim() || !currentOpp.organization?.trim()) {
      setFeedback({ type: 'error', message: 'Title and Organization are required.'});
      return;
    }

    try {
      const { id, ...rest } = currentOpp;
      const deadline = rest.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const parsedDeadline = safeDate(deadline);
      const isExpired = parsedDeadline ? isBefore(parsedDeadline, new Date()) : false;
      const finalStatus = status === 'active'&& isExpired ? 'expired': status;
      const resolvedAuthorId = rest.authorId || auth.currentUser?.uid || null;

      const galleryCleaned = Array.isArray(rest.galleryImages)
        ? rest.galleryImages.filter((u): u is string => typeof u === 'string' && u.trim().length > 0).slice(0, 8).map(u => u.slice(0, 2000))
        : undefined;

      const data = stripUndefined({
        ...rest,
        title: currentOpp.title.trim().slice(0, 200),
        organization: currentOpp.organization.trim().slice(0, 200),
        organizationLogo: (rest.organizationLogo || '').slice(0, 2000) || undefined,
        coverImageUrl: (rest.coverImageUrl || '').slice(0, 2000) || undefined,
        galleryImages: galleryCleaned && galleryCleaned.length > 0 ? galleryCleaned : undefined,
        category: rest.category || pathCategory,
        slug: generateSlug(rest.slug || currentOpp.title).slice(0, 200),
        status: finalStatus,
        description: rest.description || '<p></p>',
        location: (rest.location || 'Kigali, Rwanda').slice(0, 200),
        type: (rest.type || 'Full-time').slice(0, 100),
        applyUrl: (rest.applyUrl || '').slice(0, 2000),
        downloadUrl: (rest.downloadUrl || '').slice(0, 2000) || undefined,
        createdAt: rest.createdAt || new Date().toISOString(),
        deadline,
        authorId: resolvedAuthorId,
        views: Math.max(0, Math.floor(Number(rest.views) || 0)),
        clicks: Math.max(0, Math.floor(Number(rest.clicks) || 0)),
        featured: Boolean(rest.featured)
      });

      const logModule = (data.category === 'Others'? 'opportunities': data.category.toLowerCase()) as any;

      if (id) {
        await updateDoc(doc(db, 'opportunities', id), data);
        await logActivity(logModule, 'edit', `Edited ${data.category}: ${data.title}`, id);
      } else {
        const docRef = await addDoc(collection(db, 'opportunities'), data);
        await logActivity(logModule, 'create', `Created ${data.category}: ${data.title}`, docRef.id);
      }
      invalidatePublicCache();
      setEditorMode('list');
      setFeedback({ type: 'success', message: `${data.category} listing "${data.title}" saved.` });
      fetchData();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to save opportunity.') });
    }
  };

  const toggleStatus = async (opp: Opportunity) => {
    const newStatus = opp.status === 'active'? 'draft': 'active';
    try {
      await updateDoc(doc(db, 'opportunities', opp.id), { status: newStatus });
      invalidatePublicCache();
      const logModule = (opp.category === 'Others'? 'opportunities': opp.category.toLowerCase()) as any;
      await logActivity(logModule, 'edit', `Changed ${opp.title} status to ${newStatus}`, opp.id);
      setFeedback({ type: 'success', message: `"${opp.title}" status updated to ${newStatus}.` });
      fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to update status.') });
    }
  };

  const handleConfirmSingleDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    if (!deleteTarget) return;
    const logModule = (deleteTarget.category === 'Others'? 'opportunities': deleteTarget.category.toLowerCase()) as any;
    try {
      if (isPermanentDelete) {
        await permanentDeleteRecord('opportunities', deleteTarget.id, deleteTarget.title, logModule, reason);
        setFeedback({
          type: 'success',
          message: `"${deleteTarget.title}" was permanently deleted.`,
        });
      } else {
        await softDeleteRecord('opportunities', deleteTarget.id, deleteTarget.status, deleteTarget.title, logModule, reason);
        setFeedback({
          type: 'success',
          message: `"${deleteTarget.title}" was moved to Trash and removed from the public website.`,
          actionLabel: `View Deleted ${pathCategory}`,
          onAction: () => {
            setStatusFilter('deleted');
            setSelectedIds(new Set());
          },
        });
      }
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Permission denied deleting this listing.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleRestore = async (opp: Opportunity) => {
    const logModule = (opp.category === 'Others'? 'opportunities': opp.category.toLowerCase()) as any;
    try {
      await restoreRecord('opportunities', opp.id, 'draft', opp.previousStatus, opp.title, logModule);
      setFeedback({
        type: 'success',
        message: `Restored "${opp.title}" back to ${opp.category}.`,
      });
      await fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to restore listing.') });
    }
  };

  const handleConfirmPermanentFromDeleted = async (reason?: string) => {
    if (!permDeleteTarget) return;
    const logModule = (permDeleteTarget.category === 'Others'? 'opportunities': permDeleteTarget.category.toLowerCase()) as any;
    try {
      await permanentDeleteRecord('opportunities', permDeleteTarget.id, permDeleteTarget.title, logModule, reason);
      setFeedback({ type: 'success', message: `Permanently deleted "${permDeleteTarget.title}".` });
      setPermDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to permanently delete listing.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const sourceList = statusFilter === 'deleted'? deletedOpps : activeOpps;
  const filteredOpps = sourceList.filter(o => {
    const matchesSearch =
      o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.deletedByName || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'deleted') return matchesSearch;
    const d = safeDate(o.deadline);
    const expired = d ? isBefore(d, new Date()) : false;
    if (statusFilter === 'expired') return matchesSearch && (expired || o.status === 'expired');
    if (statusFilter === 'active') return matchesSearch && o.status === 'active'&& !expired;
    if (statusFilter === 'draft') return matchesSearch && o.status === 'draft';
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOpps.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOpps = filteredOpps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleConfirmBulkDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    const selectedItems = filteredOpps.filter(o => selectedIds.has(o.id));
    if (selectedItems.length === 0) return;
    const logModule = (pathCategory === 'Others'? 'opportunities': pathCategory.toLowerCase()) as any;

    if (statusFilter === 'deleted'|| isPermanentDelete) {
      if (!allowPermanent) {
        const msg = 'Only Super Administrators can permanently delete listings.';
        setFeedback({ type: 'error', message: msg });
        throw new Error(msg);
      }
      const res = await bulkPermanentDeleteRecords(
        'opportunities',
        selectedItems.map(a => ({ id: a.id, title: a.title })),
        logModule,
        reason
      );
      setFeedback({
        type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
        message: `Permanently deleted ${res.succeeded} ${pathCategory.toLowerCase()} record(s).`,
        details: res.errors,
      });
      if (res.succeeded === 0 && res.failed > 0) {
        throw new Error(res.errors[0] || 'Failed to delete selected listings.');
      }
      setSelectedIds(new Set());
      await fetchData();
      return;
    }

    const authorized = selectedItems.filter(o => canSoftDeleteContent(userProfile, o.category, o.authorId));
    const unauthorizedCount = selectedItems.length - authorized.length;

    if (authorized.length === 0) {
      const msg = 'You do not have permission to delete the selected listings.';
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }

    const res = await bulkSoftDeleteRecords(
      'opportunities',
      authorized.map(a => ({ id: a.id, status: a.status, title: a.title })),
      logModule,
      reason
    );

    const details = [...res.errors];
    if (unauthorizedCount > 0) {
      details.push(`${unauthorizedCount} item(s) skipped due to permission rules.`);
    }

    setFeedback({
      type: res.failed > 0 || unauthorizedCount > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Moved ${res.succeeded} ${pathCategory.toLowerCase()} record(s) to Trash.`,
      details,
      actionLabel: res.succeeded > 0 ? `View Deleted ${pathCategory}` : undefined,
      onAction: res.succeeded > 0 ? () => {
        setStatusFilter('deleted');
        setSelectedIds(new Set());
      } : undefined,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to move listings to Trash.');
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  const handleGalleryFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const existing = currentOpp.galleryImages || [];
    const remainingSlots = Math.max(0, 8 - existing.length);
    if (remainingSlots === 0) {
      setFeedback({ type: 'error', message: 'Maximum of 8 gallery photos per listing reached.' });
      return;
    }

    const toUpload = Array.from(files).slice(0, remainingSlots);
    setGalleryUploading(true);
    const uploadedUrls: string[] = [];
    const errors: string[] = [];

    for (const file of toUpload) {
      const err = validateUploadFile(file, 'image');
      if (err) {
        errors.push(`${file.name}: ${err}`);
        continue;
      }
      try {
        const res = await uploadMediaFile({ file, kind: 'image', registerMedia: true });
        uploadedUrls.push(res.url);
      } catch (e: any) {
        errors.push(`${file.name}: ${e?.message || 'Upload failed'}`);
      }
    }

    if (uploadedUrls.length > 0) {
      setCurrentOpp(prev => ({
        ...prev,
        galleryImages: [...(prev.galleryImages || []), ...uploadedUrls].slice(0, 8),
      }));
    }
    if (errors.length > 0) {
      setFeedback({ type: 'warning', message: 'Some gallery photos failed to upload.', details: errors });
    }
    setGalleryUploading(false);
  };

  if (editorMode === 'edit') {
    const subOptions = Array.from(
      new Set([...(SUBCATEGORY_OPTIONS[currentOpp.category || pathCategory] || SUBCATEGORY_OPTIONS.Others), ...customSubCats])
    );
    const gallery = currentOpp.galleryImages || [];

    return (
      <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 sm:pb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditorMode('list')} className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-full transition-all flex-shrink-0">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#102B4E] truncate">
              {currentOpp.id ? `Edit ${pathCategory}` : `Create New ${pathCategory}`}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button onClick={() => handleSave('draft')} className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Save Draft
            </button>
            <button onClick={() => handleSave('active')} className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 py-2.5 bg-[#083D91] hover:bg-[#07366D] text-white rounded-xl text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2">
              <Save size={18} /> {currentOpp.id ? 'Update': 'Publish'} Opportunity
            </button>
          </div>
        </div>

        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-8 min-w-0 space-y-6 sm:space-y-8">
            <div className="bg-white p-5 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
                <input
                  type="text" className="w-full text-xl sm:text-2xl md:text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0" placeholder="Enter opportunity title..." value={currentOpp.title || ''}
                  onChange={e => {
                    const title = e.target.value;
                    setCurrentOpp({ ...currentOpp, title, slug: generateSlug(title) });
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                <RichTextEditor value={currentOpp.description || ''} onChange={val => setCurrentOpp({ ...currentOpp, description: val })} placeholder="Enter full description..."/>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsibilities / Scope</label>
                <RichTextEditor value={currentOpp.responsibilities || ''} onChange={val => setCurrentOpp({ ...currentOpp, responsibilities: val })} placeholder="Key responsibilities or scope..."/>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirements & Eligibility</label>
                <RichTextEditor value={currentOpp.requirements || ''} onChange={val => setCurrentOpp({ ...currentOpp, requirements: val })} placeholder="What are the requirements?"/>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Benefits / Award Coverage</label>
                <RichTextEditor value={currentOpp.benefits || ''} onChange={val => setCurrentOpp({ ...currentOpp, benefits: val })} placeholder="Compensation, tuition coverage, or benefits..."/>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application Instructions</label>
                <RichTextEditor value={currentOpp.applicationInstructions || ''} onChange={val => setCurrentOpp({ ...currentOpp, applicationInstructions: val })} placeholder="How to apply?"/>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 min-w-0 space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-bold flex items-center gap-2"><Globe size={18} className="text-teal-500"/> Basic Info</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.category || pathCategory}
                    onChange={e => setCurrentOpp({ ...currentOpp, category: e.target.value as any })}
                  >
                    <option value="Jobs">Jobs</option>
                    <option value="Scholarships">Scholarships</option>
                    <option value="Tenders">Tenders</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sub-Category</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.subCategory || ''}
                    onChange={e => setCurrentOpp({ ...currentOpp, subCategory: e.target.value })}
                  >
                    <option value="">Select sub-category</option>
                    {subOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization / Institution</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.organization || ''} onChange={e => setCurrentOpp({ ...currentOpp, organization: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.location || ''} onChange={e => setCurrentOpp({ ...currentOpp, location: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employment / Funding Type</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="e.g. Full-time, Fully Funded, Open Tender" value={currentOpp.type || ''} onChange={e => setCurrentOpp({ ...currentOpp, type: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salary / Award Value</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="Competitive / Full Tuition" value={currentOpp.salary || ''} onChange={e => setCurrentOpp({ ...currentOpp, salary: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</label>
                  <input
                    type="date" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={safeFormatDate(currentOpp.deadline, 'yyyy-MM-dd', '')}
                    onChange={e => {
                      if (e.target.value) {
                        setCurrentOpp({ ...currentOpp, deadline: new Date(e.target.value).toISOString() });
                      }
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input
                    type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentOpp.slug || ''}
                    onChange={e => setCurrentOpp({ ...currentOpp, slug: generateSlug(e.target.value) })}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-slate-700">Featured Listing</span>
                  <button
                    type="button" onClick={() => setCurrentOpp({ ...currentOpp, featured: !currentOpp.featured })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      currentOpp.featured ? "bg-teal-500": "bg-slate-200")}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentOpp.featured ? "left-7": "left-1")} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} className="text-teal-500"/> Branding, Cover & Venue Gallery</h3>

              <ImageUploadField
                label="Organization / Sponsor Logo"
                value={currentOpp.organizationLogo || ''}
                aspectHint="logo"
                onChange={(url) => setCurrentOpp({ ...currentOpp, organizationLogo: url })}
                helperText="Shown on homepage & opportunity listing cards."
              />

              <ImageUploadField
                label="Cover / Event Banner Image (Optional)"
                value={currentOpp.coverImageUrl || ''}
                aspectHint="16:9"
                onChange={(url) => setCurrentOpp({ ...currentOpp, coverImageUrl: url })}
                helperText="Hero banner displayed above listing details."
              />

              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Venue & Event Gallery ({gallery.length}/8)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={galleryUploading || gallery.length >= 8}
                      onClick={() => galleryFileRef.current?.click()}
                      className="min-h-[34px] px-2.5 py-1 bg-[#083D91] text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Upload size={12} /> Add Photos
                    </button>
                    <button
                      type="button"
                      disabled={galleryUploading || gallery.length >= 8}
                      onClick={() => galleryCamRef.current?.click()}
                      className="min-h-[34px] px-2.5 py-1 bg-slate-100 text-[#102B4E] rounded-lg text-[11px] font-bold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                      <Camera size={12} />
                    </button>
                  </div>
                </div>
                <input
                  ref={galleryFileRef}
                  type="file"
                  multiple
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    handleGalleryFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={galleryCamRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    handleGalleryFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                {galleryUploading && (
                  <p className="text-xs font-semibold text-teal-600 animate-pulse">Uploading gallery photos...</p>
                )}
                {gallery.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {gallery.map((imgUrl, idx) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 group">
                        <img src={imgUrl} alt={`Gallery ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 bg-slate-900/75 rounded-lg px-1.5 py-1">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => {
                                const copy = [...gallery];
                                [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                                setCurrentOpp({ ...currentOpp, galleryImages: copy });
                              }}
                              className="p-1 text-white disabled:opacity-30 cursor-pointer"
                              title="Move left"
                            >
                              <ArrowLeft size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === gallery.length - 1}
                              onClick={() => {
                                const copy = [...gallery];
                                [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
                                setCurrentOpp({ ...currentOpp, galleryImages: copy });
                              }}
                              className="p-1 text-white disabled:opacity-30 cursor-pointer"
                              title="Move right"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setCurrentOpp({
                                ...currentOpp,
                                galleryImages: gallery.filter((_, i) => i !== idx),
                              })
                            }
                            className="p-1 text-red-300 hover:text-red-100 cursor-pointer"
                            title="Remove photo"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-bold flex items-center gap-2"><LinkIcon size={18} className="text-teal-500"/> Links & Attachments</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Apply URL</label>
                <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentOpp.applyUrl || ''} onChange={e => setCurrentOpp({ ...currentOpp, applyUrl: e.target.value })} placeholder="https://..."/>
              </div>
              <FileUploadField
                label="Tender / Program Document (PDF, DOC, Scan)"
                value={currentOpp.downloadUrl || ''}
                onChange={(url) => setCurrentOpp({ ...currentOpp, downloadUrl: url })}
                helperText="Attach official PDF notices, application forms, or scanned schedules."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">{pathCategory} Management</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Post, manage, and inspect or restore deleted {pathCategory.toLowerCase()} listings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavLink
            to="/admin/trash" className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Trash2 size={16} /> Trash
            {deletedOpps.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                {deletedOpps.length}
              </span>
            )}
          </NavLink>
          <button
            onClick={() => {
              setCurrentOpp({
                status: 'active',
                category: pathCategory,
                type: 'Full-time',
                location: 'Kigali, Rwanda',
                deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                description: '',
                requirements: '',
                applicationInstructions: ''});
              setEditorMode('edit');
            }}
            className="flex-1 sm:flex-none min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
            <Plus size={20} /> Add {pathCategory === 'Others'? 'Opportunity': pathCategory.slice(0, -1)}
          </button>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder={`Search ${pathCategory.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'draft', 'expired', 'deleted'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); setSelectedIds(new Set()); }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                statusFilter === s
                  ? (s === 'deleted'? "bg-red-600 text-white": "bg-[#083D91] text-white")
                  : (s === 'deleted'? "bg-red-50 text-red-600 hover:bg-red-100": "bg-slate-50 text-slate-500 hover:bg-slate-100")
              )}
            >
              {s === 'deleted'? `Deleted (${deletedOpps.length})` : s}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={paginatedOpps.length}
        totalFilteredCount={filteredOpps.length}
        allFilteredSelected={selectedIds.size === filteredOpps.length && filteredOpps.length > 0}
        onSelectPage={(checked) => {
          const next = new Set(selectedIds);
          paginatedOpps.forEach(o => checked ? next.add(o.id) : next.delete(o.id));
          setSelectedIds(next);
        }}
        onSelectAllFiltered={() => setSelectedIds(new Set(filteredOpps.map(o => o.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        bulkDeleteLabel={statusFilter === 'deleted'? 'Permanently Delete': 'Delete Selected'}
        canDelete={statusFilter === 'deleted'? allowPermanent : true}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading {pathCategory.toLowerCase()}...</div>
        ) : paginatedOpps.map((opp) => {
          const isDeleted = opp.status === 'deleted';
          const parsedDeadline = safeDate(opp.deadline);
          const expired = parsedDeadline ? isBefore(parsedDeadline, new Date()) : false;
          const allowDelete = canSoftDeleteContent(userProfile, opp.category, opp.authorId);
          return (
            <div key={opp.id} className={cn(
              "bg-white rounded-3xl border shadow-sm overflow-hidden group flex flex-col justify-between min-w-0",
              isDeleted ? "border-red-200 bg-red-50/15": "border-slate-100")}>
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4 gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox" checked={selectedIds.has(opp.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(opp.id)) next.delete(opp.id);
                        else next.add(opp.id);
                        setSelectedIds(next);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-[#083D91] flex-shrink-0"/>
                    <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider truncate">
                      {opp.subCategory || opp.category}
                    </span>
                  </div>
                  {!isDeleted && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleStatus(opp)} className="min-w-[36px] min-h-[36px] p-1.5 text-slate-400 hover:text-[#083D91] flex items-center justify-center rounded-lg hover:bg-slate-50" title={opp.status === 'active'? 'Unpublish': 'Publish'}>
                        {opp.status === 'active'? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button onClick={() => { setCurrentOpp(opp); setEditorMode('edit'); }} className="min-w-[36px] min-h-[36px] p-1.5 text-slate-400 hover:text-teal-600 flex items-center justify-center rounded-lg hover:bg-slate-50" title="Edit"><Edit size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3 mb-3">
                  {opp.organizationLogo && (
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
                      <img src={opp.organizationLogo} alt={opp.organization} referrerPolicy="no-referrer" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <h3 className="font-bold text-[#102B4E] text-base sm:text-lg line-clamp-2 min-h-[3rem]">{opp.title}</h3>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
                    <Building2 size={14} className="text-slate-400 flex-shrink-0"/> <span className="truncate">{opp.organization}</span>
                  </div>
                  {isDeleted ? (
                    <div className="text-xs text-red-600 font-medium space-y-1">
                      <p>Deleted {safeFormatDate(opp.deletedAt, 'MMM dd, yyyy HH:mm')}{opp.deletedByName ? ` by ${opp.deletedByName}` : ''}</p>
                      {opp.deleteReason && <p className="italic text-slate-500">Reason: {opp.deleteReason}</p>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                      <Clock size={14} className="text-amber-500 flex-shrink-0"/> {safeFormatDate(opp.deadline, 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-4 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-400 uppercase">
                {isDeleted ? (
                  <>
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">Deleted</span>
                    <div className="flex flex-wrap items-center gap-1.5 normal-case">
                      {allowRestore && (
                        <button
                          onClick={() => handleRestore(opp)}
                          className="min-h-[36px] px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all">
                          <RotateCcw size={13} /> Restore
                        </button>
                      )}
                      {allowPermanent && (
                        <button
                          onClick={() => setPermDeleteTarget(opp)}
                          className="min-h-[36px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-all">
                          <Trash2 size={13} /> Delete Forever
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{opp.views || 0} Views</span>
                      {expired && (
                        <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded">
                          <AlertCircle size={10} /> Expired
                        </span>
                      )}
                      <span className={cn("px-2 py-0.5 rounded", opp.status === 'active'? "text-emerald-500 bg-emerald-50": "bg-slate-100")}>{opp.status}</span>
                    </div>
                    {allowDelete && (
                      <button
                        onClick={() => setDeleteTarget(opp)}
                        className="min-h-[36px] px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold normal-case inline-flex items-center gap-1 transition-all">
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filteredOpps.length === 0 && (
          <div className="col-span-full bg-white p-12 sm:p-16 rounded-3xl border border-slate-100 text-center text-slate-400 italic">
            {statusFilter === 'deleted'? `No deleted ${pathCategory.toLowerCase()} in Trash.`
              : `No ${pathCategory.toLowerCase()} listings found. Click "Add" to create one.`}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={cn(
                "min-w-[40px] min-h-[40px] px-2 rounded-xl text-xs font-bold transition-all",
                p === safePage ? "bg-[#083D91] text-white": "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmSingleDelete}
        title={`Delete ${deleteTarget?.category === 'Others'? 'Opportunity': deleteTarget?.category?.slice(0, -1) || 'Listing'}?`}
        itemName={deleteTarget?.title}
        description="This action removes the listing from the public website and moves it to Trash (visible under the Deleted tab & Recycle Bin)." confirmLabel="Move to Trash" allowPermanentOption={allowPermanent}
      />

      <DeleteConfirmModal
        isOpen={Boolean(permDeleteTarget)}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handleConfirmPermanentFromDeleted}
        title="Permanently Delete Listing?" itemName={permDeleteTarget?.title}
        description="This listing will be permanently erased from Firestore and cannot be restored." confirmLabel="Delete Forever" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={statusFilter === 'deleted'? `Permanently Delete ${selectedIds.size} Deleted Listings?`
          : `Delete ${selectedIds.size} Selected Listings?`}
        description={statusFilter === 'deleted'? `These ${selectedIds.size} trashed record(s) will be permanently erased from Firestore.`
          : `Move ${selectedIds.size} selected ${pathCategory.toLowerCase()} record(s) to Trash? They will immediately disappear from public listings.`}
        confirmLabel={statusFilter === 'deleted'? 'Delete Forever': `Move ${selectedIds.size} to Trash`}
        isPermanent={statusFilter === 'deleted'}
        allowPermanentOption={statusFilter !== 'deleted'&& allowPermanent}
        requireTypeDelete={statusFilter === 'deleted'|| selectedIds.size > 5}
      />
    </div>
  );
}
