import React from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { WebPage } from '../../types';
import { Plus, Trash2, Edit, FileText, Settings, Save, Lock, RotateCcw } from 'lucide-react';
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
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { isProtectedSystemPage, canPermanentDelete, canRestoreContent } from '../../lib/permissions';
import { useAdminAuth } from './AdminLayout';
import { cn, generateSlug, safeFormatDate, extractErrorMessage, stripUndefined } from '../../lib/utils';
import { NavLink } from 'react-router-dom';

export function PageManagement() {
  const { userProfile } = useAdminAuth();
  const [allPages, setAllPages] = React.useState<WebPage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list'| 'edit'>('list');
  const [viewFilter, setViewFilter] = React.useState<'active'| 'deleted'>('active');
  const [currentPage, setCurrentPage] = React.useState<Partial<WebPage>>({});

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<WebPage | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = React.useState<WebPage | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null);

  const allowPermanent = canPermanentDelete(userProfile);
  const allowRestore = canRestoreContent(userProfile);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'pages'), orderBy('slug', 'asc'));
      const snap = await getDocs(q);
      setAllPages(snap.docs.map(d => ({ id: d.id, ...d.data() } as WebPage)));
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load website pages.'});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const pages = React.useMemo(() => allPages.filter(p => p.status !== 'deleted'), [allPages]);
  const deletedPages = React.useMemo(() => allPages.filter(p => p.status === 'deleted'), [allPages]);

  const handleSave = async () => {
    if (!currentPage.title?.trim() || !currentPage.slug?.trim()) {
      setFeedback({ type: 'error', message: 'Title and URL Slug are required.'});
      return;
    }
    try {
      const { id, ...rest } = currentPage;
      const data = stripUndefined({
        ...rest,
        title: currentPage.title.trim().slice(0, 120),
        slug: generateSlug(currentPage.slug).slice(0, 120),
        content: rest.content || '<p></p>',
        imageUrl: (rest.imageUrl || '').slice(0, 2000),
        lastUpdated: new Date().toISOString(),
        status: rest.status || 'published'});
      if (id) {
        await updateDoc(doc(db, 'pages', id), data);
        await logActivity('pages', 'edit', `Edited page: ${data.title}`, id);
      } else {
        const docRef = await addDoc(collection(db, 'pages'), data);
        await logActivity('pages', 'create', `Created page: ${data.title}`, docRef.id);
      }
      setEditorMode('list');
      setFeedback({ type: 'success', message: `Page "${data.title}" saved.` });
      fetchData();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to save page.') });
    }
  };

  const handleConfirmDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    if (!deleteTarget) return;
    if (isProtectedSystemPage(deleteTarget.slug, deleteTarget.isSystem)) {
      const msg = `"${deleteTarget.title}" is a protected essential page and cannot be deleted.`;
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
    try {
      if (isPermanentDelete) {
        await permanentDeleteRecord('pages', deleteTarget.id, deleteTarget.title, 'pages', reason);
        setFeedback({ type: 'success', message: `Page "${deleteTarget.title}" permanently deleted.` });
      } else {
        await softDeleteRecord('pages', deleteTarget.id, deleteTarget.status, deleteTarget.title, 'pages', reason);
        setFeedback({
          type: 'success',
          message: `Page "${deleteTarget.title}" moved to Trash.`,
          actionLabel: 'View Deleted Pages',
          onAction: () => {
            setViewFilter('deleted');
            setSelectedIds(new Set());
          },
        });
      }
      setDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to delete page.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleRestore = async (page: WebPage) => {
    try {
      await restoreRecord('pages', page.id, 'draft', page.previousStatus, page.title, 'pages');
      setFeedback({ type: 'success', message: `Restored page "${page.title}".` });
      await fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to restore page.') });
    }
  };

  const handleConfirmPermanent = async (reason?: string) => {
    if (!permDeleteTarget) return;
    try {
      await permanentDeleteRecord('pages', permDeleteTarget.id, permDeleteTarget.title, 'pages', reason);
      setFeedback({ type: 'success', message: `Permanently deleted page "${permDeleteTarget.title}".` });
      setPermDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to permanently delete page.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    const activeList = viewFilter === 'deleted'? deletedPages : pages;
    const selected = activeList.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;

    if (viewFilter === 'deleted'|| isPermanentDelete) {
      if (!allowPermanent) {
        const msg = 'Only Super Administrators can permanently delete pages.';
        setFeedback({ type: 'error', message: msg });
        throw new Error(msg);
      }
      const res = await bulkPermanentDeleteRecords(
        'pages',
        selected.map(p => ({ id: p.id, title: p.title })),
        'pages',
        reason
      );
      setFeedback({
        type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
        message: `Permanently deleted ${res.succeeded} page(s).`,
        details: res.errors,
      });
      if (res.succeeded === 0 && res.failed > 0) {
        throw new Error(res.errors[0] || 'Failed to permanently delete pages.');
      }
      setSelectedIds(new Set());
      await fetchData();
      return;
    }

    const deletable = selected.filter(p => !isProtectedSystemPage(p.slug, p.isSystem));
    const skipped = selected.length - deletable.length;

    if (deletable.length === 0) {
      const msg = 'Selected page(s) are protected system pages and cannot be deleted.';
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }

    const res = await bulkSoftDeleteRecords(
      'pages',
      deletable.map(p => ({ id: p.id, status: p.status, title: p.title })),
      'pages',
      reason
    );

    const details = [...res.errors];
    if (skipped > 0) details.push(`${skipped} protected system page(s) skipped.`);

    setFeedback({
      type: res.failed > 0 || skipped > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Moved ${res.succeeded} page(s) to Trash.${skipped > 0 ? ` ${skipped} protected page(s) skipped.` : ''}`,
      details,
      actionLabel: res.succeeded > 0 ? 'View Deleted Pages': undefined,
      onAction: res.succeeded > 0 ? () => {
        setViewFilter('deleted');
        setSelectedIds(new Set());
      } : undefined,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete pages.');
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  if (editorMode === 'edit') {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-slate-200 pb-4 sm:pb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#102B4E]">{currentPage.id ? 'Edit Page': 'New Page'}</h1>
          <div className="flex flex-wrap gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button onClick={() => setEditorMode('list')} className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
              <Save size={18} /> Save Page
            </button>
          </div>
        </div>
        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 min-w-0 space-y-6">
            <div className="space-y-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page Title</label>
              <input
                className="w-full text-xl sm:text-2xl md:text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0" placeholder="Enter title..." value={currentPage.title || ''}
                onChange={e => {
                  const title = e.target.value;
                  setCurrentPage({
                    ...currentPage,
                    title,
                    slug: currentPage.id ? currentPage.slug : generateSlug(title)
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page Content</label>
              <RichTextEditor value={currentPage.content || ''} onChange={c => setCurrentPage({ ...currentPage, content: c })} placeholder="Write your page content here..."/>
            </div>
          </div>
          <div className="min-w-0 space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold flex items-center gap-2 text-[#102B4E]"><Settings size={18} className="text-teal-500"/> Page Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentPage.slug || ''} onChange={e => setCurrentPage({ ...currentPage, slug: generateSlug(e.target.value) })} placeholder="about, privacy, terms, etc."/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEO Title</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentPage.seoTitle || ''} onChange={e => setCurrentPage({ ...currentPage, seoTitle: e.target.value })} placeholder="Custom title for search engines"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEO Description</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm h-24 resize-none" value={currentPage.seoDescription || ''} onChange={e => setCurrentPage({ ...currentPage, seoDescription: e.target.value })} placeholder="Brief meta description..."/>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Status</span>
                  <select
                    className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-bold" value={currentPage.status || 'published'}
                    onChange={e => setCurrentPage({ ...currentPage, status: e.target.value as any })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <ImageUploadField
                  label="Page Header / Cover Image (Optional)"
                  value={currentPage.imageUrl || ''}
                  aspectHint="16:9"
                  onChange={(url) => setCurrentPage({ ...currentPage, imageUrl: url })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayedPages = viewFilter === 'deleted'? deletedPages : pages;
  const selectablePages = viewFilter === 'deleted'? deletedPages
    : pages.filter(p => !isProtectedSystemPage(p.slug, p.isSystem));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Website Pages</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage custom pages. Essential legal and system pages (about, privacy, terms) are protected against deletion.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavLink
            to="/admin/trash" className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Trash2 size={16} /> Trash
            {deletedPages.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                {deletedPages.length}
              </span>
            )}
          </NavLink>
          <button onClick={() => { setCurrentPage({ status: 'published', content: ''}); setEditorMode('edit'); }} className="flex-1 sm:flex-none min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
            <Plus size={20} /> Create New Page
          </button>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-2">
        <button
          onClick={() => { setViewFilter('active'); setSelectedIds(new Set()); }}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            viewFilter === 'active'? "bg-[#083D91] text-white": "bg-slate-50 text-slate-500 hover:bg-slate-100")}
        >
          Active Pages ({pages.length})
        </button>
        <button
          onClick={() => { setViewFilter('deleted'); setSelectedIds(new Set()); }}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition-all",
            viewFilter === 'deleted'? "bg-red-600 text-white": "bg-red-50 text-red-600 hover:bg-red-100")}
        >
          Deleted ({deletedPages.length})
        </button>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={selectablePages.length}
        totalFilteredCount={selectablePages.length}
        allFilteredSelected={selectedIds.size === selectablePages.length && selectablePages.length > 0}
        onSelectPage={(checked) => setSelectedIds(checked ? new Set(selectablePages.map(p => p.id)) : new Set())}
        onSelectAllFiltered={() => setSelectedIds(new Set(selectablePages.map(p => p.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        bulkDeleteLabel={viewFilter === 'deleted'? 'Permanently Delete': 'Delete Selected'}
        canDelete={viewFilter === 'deleted'? allowPermanent : true}
      />

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-400">Loading pages...</div>
        ) : displayedPages.map(page => {
          const isDeleted = page.status === 'deleted';
          const isProtected = isProtectedSystemPage(page.slug, page.isSystem);
          return (
            <div key={page.id} className={cn(
              "bg-white p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:shadow-md transition-all",
              isDeleted ? "border-red-100 bg-red-50/15": "border-slate-100")}>
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <input
                  type="checkbox" disabled={!isDeleted && isProtected}
                  checked={selectedIds.has(page.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(page.id)) next.delete(page.id);
                    else next.add(page.id);
                    setSelectedIds(next);
                  }}
                  className="w-4 h-4 mt-1 sm:mt-0 rounded border-slate-300 text-[#083D91] disabled:opacity-30 flex-shrink-0"/>
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden">
                  {page.imageUrl ? (
                    <img src={page.imageUrl} alt={page.title} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <FileText size={22} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 break-words">{page.title}</h3>
                    {isProtected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#083D91] rounded-md text-[10px] font-bold">
                        <Lock size={10} /> Protected System Page
                      </span>
                    )}
                  </div>
                  {isDeleted ? (
                    <p className="text-xs text-red-600 font-medium mt-1">
                      Deleted {safeFormatDate(page.deletedAt, 'MMM dd, yyyy HH:mm')}
                      {page.deletedByName ? ` by ${page.deletedByName}` : ''}
                      {page.deleteReason ? ` • Reason: ${page.deleteReason}` : ''}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5 mt-1">
                      <p className="text-[10px] text-slate-400 font-mono break-all">/{page.slug === 'about'|| page.slug === 'privacy'|| page.slug === 'terms'? page.slug : `p/${page.slug}`}</p>
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest", page.status === 'published'? "bg-emerald-50 text-emerald-600": "bg-slate-100 text-slate-500")}>{page.status}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {isDeleted ? (
                  <>
                    {allowRestore && (
                      <button
                        onClick={() => handleRestore(page)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 transition-all">
                        <RotateCcw size={14} /> Restore
                      </button>
                    )}
                    {allowPermanent && (
                      <button
                        onClick={() => setPermDeleteTarget(page)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                        <Trash2 size={14} /> Delete Forever
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setCurrentPage(page); setEditorMode('edit'); }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg inline-flex items-center gap-1 transition-all">
                      <Edit size={15} /> Edit
                    </button>
                    {isProtected ? (
                      <span className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-50 rounded-lg inline-flex items-center gap-1 cursor-not-allowed" title="System pages cannot be deleted">
                        <Lock size={14} /> Protected
                      </span>
                    ) : (
                      <button
                        onClick={() => setDeleteTarget(page)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!loading && displayedPages.length === 0 && (
          <div className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            {viewFilter === 'deleted'? 'No deleted pages in Trash.': 'No custom pages created yet. Create "about", "privacy", or "terms" to customize those pages!'}
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Custom Page?" itemName={deleteTarget?.title}
        description="This custom page will be moved to Trash and removed from public routes." confirmLabel="Move to Trash" allowPermanentOption={allowPermanent}
      />

      <DeleteConfirmModal
        isOpen={Boolean(permDeleteTarget)}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handleConfirmPermanent}
        title="Permanently Delete Page?" itemName={permDeleteTarget?.title}
        description="This page will be permanently removed from Firestore and cannot be restored." confirmLabel="Delete Forever" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={viewFilter === 'deleted'? `Permanently Delete ${selectedIds.size} Deleted Pages?`
          : `Delete ${selectedIds.size} Selected Pages?`}
        description={viewFilter === 'deleted'? 'Selected trashed pages will be permanently removed from Firestore.': 'Selected custom pages will be moved to Trash. Protected system pages cannot be deleted.'}
        confirmLabel={viewFilter === 'deleted'? 'Delete Forever': 'Move to Trash'}
        isPermanent={viewFilter === 'deleted'}
        allowPermanentOption={viewFilter !== 'deleted'&& allowPermanent}
        requireTypeDelete={viewFilter === 'deleted'}
      />
    </div>
  );
}
