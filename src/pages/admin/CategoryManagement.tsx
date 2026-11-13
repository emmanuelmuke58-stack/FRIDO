import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { CategoryItem, NewsItem, Opportunity } from '../../types';
import {
  Plus, Trash2, Edit, FolderTree, Search, Save, X, ArrowRightLeft, AlertTriangle, RotateCcw
} from 'lucide-react';
import {
  logActivity,
  softDeleteRecord,
  bulkSoftDeleteRecords,
  permanentDeleteRecord,
  bulkPermanentDeleteRecords,
  restoreRecord,
} from '../../lib/services';
import { cn, generateSlug, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import { invalidatePublicCache } from '../../lib/publicData';
import { useAdminAuth } from './AdminLayout';
import { canPermanentDelete, canRestoreContent } from '../../lib/permissions';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { NavLink } from 'react-router-dom';

const MODULES: CategoryItem['module'][] = ['News', 'Jobs', 'Scholarships', 'Tenders', 'Others'];

export function CategoryManagement() {
  const { userProfile } = useAdminAuth();
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [oppList, setOppList] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isFormOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<CategoryItem>>({ module: 'News'});

  // Delete / Reassignment state
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = useState<CategoryItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [reassignTargetName, setReassignTargetName] = useState('');

  const canDelete = userProfile?.role === 'super_admin'|| userProfile?.role === 'admin';
  const allowPermanent = canPermanentDelete(userProfile);
  const allowRestore = canRestoreContent(userProfile);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catSnap, newsSnap, oppSnap] = await Promise.all([
        getDocs(query(collection(db, 'categories'), orderBy('name', 'asc'))),
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'opportunities')),
      ]);
      setAllCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryItem)));
      setNewsList(
        newsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as NewsItem))
          .filter(n => n.status !== 'deleted')
      );
      setOppList(
        oppSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Opportunity))
          .filter(o => o.status !== 'deleted')
      );
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load categories.'});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categories = React.useMemo(() => allCategories.filter(c => c.status !== 'deleted'), [allCategories]);
  const deletedCategories = React.useMemo(() => allCategories.filter(c => c.status === 'deleted'), [allCategories]);

  const getUsageCount = (cat: CategoryItem): number => {
    if (cat.module === 'News') {
      return newsList.filter(n => n.category === cat.name).length;
    }
    return oppList.filter(o => o.category === cat.module && o.subCategory === cat.name).length;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing.name?.trim()) return;
    try {
      const { id, ...rest } = editing;
      const data: Record<string, any> = {
        name: editing.name.trim().slice(0, 100),
        slug: generateSlug(rest.slug || editing.name).slice(0, 100),
        module: rest.module || 'News',
        parentCategory: (rest.parentCategory?.trim() || '').slice(0, 100),
        description: (rest.description?.trim() || '').slice(0, 500),
        imageUrl: (rest.imageUrl?.trim() || '').slice(0, 2000),
        thumbnailUrl: (rest.thumbnailUrl?.trim() || rest.imageUrl?.trim() || '').slice(0, 2000),
        status: 'active',
        createdAt: rest.createdAt || new Date().toISOString(),
      };
      if (id) {
        await updateDoc(doc(db, 'categories', id), data);
        await logActivity('categories', 'edit', `Updated category: ${data.name} (${data.module})`, id);
        setFeedback({ type: 'success', message: `Category "${data.name}" updated.` });
      } else {
        const ref = await addDoc(collection(db, 'categories'), data);
        await logActivity('categories', 'create', `Created category: ${data.name} (${data.module})`, ref.id);
        setFeedback({ type: 'success', message: `Category "${data.name}" created.` });
      }
      invalidatePublicCache();
      setFormOpen(false);
      setEditing({ module: 'News'});
      fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(err, 'Failed to save category.') });
    }
  };

  const sourceList = moduleFilter === 'Deleted'? deletedCategories : categories;
  const filtered = sourceList.filter(c => {
    const matchesMod = moduleFilter === 'All'|| moduleFilter === 'Deleted'|| c.module === moduleFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.deletedByName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMod && matchesSearch;
  });

  const targetUsageCount = deleteTarget ? getUsageCount(deleteTarget) : 0;
  const availableReassignments = deleteTarget
    ? categories.filter(c => c.id !== deleteTarget.id && c.module === deleteTarget.module)
    : [];

  const handleDeleteConfirm = async (reason?: string, isPermanentDelete?: boolean) => {
    if (!deleteTarget) return;
    try {
      if (targetUsageCount > 0) {
        if (!reassignTargetName) {
          const msg = 'Please select a replacement category to reassign existing records before deleting.';
          setFeedback({ type: 'error', message: msg });
          throw new Error(msg);
        }
        const batch = writeBatch(db);
        if (deleteTarget.module === 'News') {
          newsList
            .filter(n => n.category === deleteTarget.name)
            .forEach(n => batch.update(doc(db, 'news', n.id), { category: reassignTargetName }));
        } else {
          oppList
            .filter(o => o.category === deleteTarget.module && o.subCategory === deleteTarget.name)
            .forEach(o => batch.update(doc(db, 'opportunities', o.id), { subCategory: reassignTargetName }));
        }
        await batch.commit();
      }

      if (isPermanentDelete) {
        await permanentDeleteRecord('categories', deleteTarget.id, `${deleteTarget.name} (${deleteTarget.module})`, 'categories', reason);
        setFeedback({
          type: 'success',
          message: targetUsageCount > 0
            ? `Reassigned ${targetUsageCount} record(s) to "${reassignTargetName}" and permanently deleted "${deleteTarget.name}".`
            : `Category "${deleteTarget.name}" permanently deleted.`,
        });
      } else {
        await softDeleteRecord(
          'categories',
          deleteTarget.id,
          deleteTarget.status,
          `${deleteTarget.name} (${deleteTarget.module})`,
          'categories',
          reason
        );
        setFeedback({
          type: 'success',
          message: targetUsageCount > 0
            ? `Reassigned ${targetUsageCount} record(s) to "${reassignTargetName}" and moved category "${deleteTarget.name}" to Trash.`
            : `Category "${deleteTarget.name}" moved to Trash.`,
          actionLabel: 'View Deleted Categories',
          onAction: () => {
            setModuleFilter('Deleted');
            setSelectedIds(new Set());
          },
        });
      }

      setDeleteTarget(null);
      setReassignTargetName('');
      await fetchData();
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to delete category.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleRestore = async (cat: CategoryItem) => {
    try {
      await restoreRecord('categories', cat.id, 'active', cat.previousStatus, `${cat.name} (${cat.module})`, 'categories');
      setFeedback({ type: 'success', message: `Restored category "${cat.name}".` });
      await fetchData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(err, 'Failed to restore category.') });
    }
  };

  const handleConfirmPermanent = async (reason?: string) => {
    if (!permDeleteTarget) return;
    try {
      await permanentDeleteRecord('categories', permDeleteTarget.id, `${permDeleteTarget.name} (${permDeleteTarget.module})`, 'categories', reason);
      setFeedback({ type: 'success', message: `Permanently deleted category "${permDeleteTarget.name}".` });
      setPermDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to permanently delete category.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkDeleteConfirm = async (reason?: string, isPermanentDelete?: boolean) => {
    const selectedCats = filtered.filter(c => selectedIds.has(c.id));
    if (selectedCats.length === 0) return;

    if (moduleFilter === 'Deleted'|| isPermanentDelete) {
      if (!allowPermanent) {
        const msg = 'Only Super Administrators can permanently delete categories.';
        setFeedback({ type: 'error', message: msg });
        throw new Error(msg);
      }
      const unusedOrAll = moduleFilter === 'Deleted'? selectedCats : selectedCats.filter(c => getUsageCount(c) === 0);
      if (unusedOrAll.length === 0) {
        const msg = 'Selected categories are currently in use. Delete them individually to reassign content first.';
        setFeedback({ type: 'error', message: msg });
        throw new Error(msg);
      }
      const res = await bulkPermanentDeleteRecords(
        'categories',
        unusedOrAll.map(c => ({ id: c.id, title: c.name })),
        'categories',
        reason
      );
      setFeedback({
        type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
        message: `Permanently deleted ${res.succeeded} categor${res.succeeded === 1 ? 'y': 'ies'}.`,
        details: res.errors,
      });
      if (res.succeeded === 0 && res.failed > 0) {
        throw new Error(res.errors[0] || 'Failed to delete categories.');
      }
      setSelectedIds(new Set());
      await fetchData();
      return;
    }

    const inUse = selectedCats.filter(c => getUsageCount(c) > 0);
    const unused = selectedCats.filter(c => getUsageCount(c) === 0);

    if (unused.length === 0) {
      const msg = 'All selected categories currently contain published/active items. Delete them individually to reassign their content first.';
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }

    const res = await bulkSoftDeleteRecords(
      'categories',
      unused.map(c => ({ id: c.id, status: c.status, title: c.name })),
      'categories',
      reason
    );

    const details = [
      ...res.errors,
      ...inUse.map(c => `Skipped "${c.name}" (${getUsageCount(c)} items in use — reassign individually)`),
    ];

    setFeedback({
      type: res.failed > 0 || inUse.length > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Moved ${res.succeeded} unused categor${res.succeeded === 1 ? 'y': 'ies'} to Trash.${inUse.length > 0 ? ` ${inUse.length} skipped (in use).` : ''}`,
      details,
      actionLabel: res.succeeded > 0 ? 'View Deleted Categories': undefined,
      onAction: res.succeeded > 0 ? () => {
        setModuleFilter('Deleted');
        setSelectedIds(new Set());
      } : undefined,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete categories.');
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Category Management</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Organize categories & subcategories across News, Jobs, Scholarships, Tenders, and Opportunities.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavLink
            to="/admin/trash" className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Trash2 size={16} /> Trash
            {deletedCategories.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                {deletedCategories.length}
              </span>
            )}
          </NavLink>
          {canDelete && (
            <button
              onClick={() => { setEditing({ module: 'News'}); setFormOpen(true); }}
              className="flex-1 sm:flex-none min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all">
              <Plus size={20} /> Add Category
            </button>
          )}
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {isFormOpen && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-lg space-y-5">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg text-[#102B4E]">{editing.id ? 'Edit Category': 'Create New Category'}</h3>
            <button onClick={() => setFormOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category Name</label>
              <input
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editing.name || ''}
                onChange={e => setEditing({ ...editing, name: e.target.value, slug: editing.id ? editing.slug : generateSlug(e.target.value) })}
                placeholder="e.g., Technology, Government, Fellowships"/>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Module</label>
              <select
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editing.module || 'News'}
                onChange={e => setEditing({ ...editing, module: e.target.value as CategoryItem['module'] })}
              >
                {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
              <input
                required
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono" value={editing.slug || ''}
                onChange={e => setEditing({ ...editing, slug: generateSlug(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Parent Category (Optional for Subcategories)</label>
              <input
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editing.parentCategory || ''}
                onChange={e => setEditing({ ...editing, parentCategory: e.target.value })}
                placeholder="Leave blank for top-level"/>
            </div>
            <div className="md:col-span-2">
              <ImageUploadField
                label="Category Thumbnail / Cover Image (Optional)"
                value={editing.imageUrl || ''}
                aspectHint="4:3"
                onChange={(url, meta) =>
                  setEditing({
                    ...editing,
                    imageUrl: url,
                    thumbnailUrl: meta?.thumbnailUrl || url,
                  })
                }
              />
            </div>
            <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
              <button type="button" onClick={() => setFormOpen(false)} className="min-h-[44px] px-5 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600">Cancel</button>
              <button type="submit" className="min-h-[44px] px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Save size={16} /> Save Category
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search categories..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', ...MODULES, 'Deleted'].map(m => (
            <button
              key={m}
              onClick={() => { setModuleFilter(m); setSelectedIds(new Set()); }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                moduleFilter === m
                  ? (m === 'Deleted'? "bg-red-600 text-white": "bg-[#083D91] text-white")
                  : (m === 'Deleted'? "bg-red-50 text-red-600 hover:bg-red-100": "bg-slate-50 text-slate-500 hover:bg-slate-100")
              )}
            >
              {m === 'Deleted'? `Deleted (${deletedCategories.length})` : m}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={filtered.length}
        totalFilteredCount={filtered.length}
        allFilteredSelected={selectedIds.size === filtered.length && filtered.length > 0}
        onSelectPage={(checked) => setSelectedIds(checked ? new Set(filtered.map(c => c.id)) : new Set())}
        onSelectAllFiltered={() => setSelectedIds(new Set(filtered.map(c => c.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        bulkDeleteLabel={moduleFilter === 'Deleted'? 'Permanently Delete': 'Delete Selected'}
        canDelete={moduleFilter === 'Deleted'? allowPermanent : canDelete}
      />

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center text-slate-400">Loading categories...</div>
        ) : filtered.map(cat => {
          const isDeleted = cat.status === 'deleted';
          const count = getUsageCount(cat);
          return (
            <div key={cat.id} className={cn("bg-white p-4 rounded-2xl border shadow-sm space-y-3", isDeleted ? "border-red-100 bg-red-50/20" : "border-slate-100")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(cat.id)}
                    onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(cat.id)) next.delete(cat.id);
                      else next.add(cat.id);
                      setSelectedIds(next);
                    }}
                    className="w-4 h-4 mt-1 rounded border-slate-300 text-[#083D91] flex-shrink-0"
                  />
                  <div className="w-9 h-9 bg-blue-50 text-[#083D91] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {cat.thumbnailUrl || cat.imageUrl ? (
                      <img src={cat.thumbnailUrl || cat.imageUrl} alt={cat.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <FolderTree size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#102B4E] break-words">{cat.name}</p>
                    <p className="text-[11px] font-mono text-slate-400 break-all">
                      /{cat.slug}{cat.parentCategory ? ` • Sub of ${cat.parentCategory}` : ''}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold flex-shrink-0">{cat.module}</span>
              </div>

              <div>
                {isDeleted ? (
                  <div className="text-xs text-red-600 font-medium">
                    <p>Deleted {safeFormatDate(cat.deletedAt, 'MMM dd, yyyy HH:mm')}{cat.deletedByName ? ` by ${cat.deletedByName}` : ''}</p>
                    {cat.deleteReason && <p className="text-slate-500 italic">Reason: {cat.deleteReason}</p>}
                  </div>
                ) : (
                  <span className={cn(
                    "inline-block px-2.5 py-1 rounded-lg text-xs font-bold",
                    count > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                  )}>
                    {count} {count === 1 ? 'record' : 'records'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
                {isDeleted ? (
                  <>
                    {allowRestore && (
                      <button
                        onClick={() => handleRestore(cat)}
                        className="min-h-[40px] px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl inline-flex items-center gap-1.5 transition-all"
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                    )}
                    {allowPermanent && (
                      <button
                        onClick={() => setPermDeleteTarget(cat)}
                        className="min-h-[40px] px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl inline-flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 size={14} /> Delete Forever
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(cat); setFormOpen(true); }}
                      className="min-h-[40px] px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:text-teal-600 hover:bg-teal-50 rounded-xl inline-flex items-center gap-1.5 transition-all"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => { setDeleteTarget(cat); setReassignTargetName(''); }}
                        className="min-h-[40px] px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl inline-flex items-center gap-1.5 transition-all"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filtered.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            {moduleFilter === 'Deleted' ? 'No deleted categories in Trash.' : 'No categories created yet. Add custom categories above to manage and organize content.'}
          </div>
        )}
      </div>

      {/* Tablet & Desktop Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="w-12 px-5 py-4"></th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Module</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {moduleFilter === 'Deleted'? 'Deletion Details': 'Linked Content'}
              </th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="p-12 text-center text-slate-400">Loading categories...</td></tr>
            ) : filtered.map(cat => {
              const isDeleted = cat.status === 'deleted';
              const count = getUsageCount(cat);
              return (
                <tr key={cat.id} className={cn("hover:bg-slate-50/50 transition-colors", isDeleted && "bg-red-50/20")}>
                  <td className="px-5 py-4">
                    <input
                      type="checkbox" checked={selectedIds.has(cat.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(cat.id)) next.delete(cat.id);
                        else next.add(cat.id);
                        setSelectedIds(next);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-[#083D91]"/>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-50 text-[#083D91] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {cat.thumbnailUrl || cat.imageUrl ? (
                          <img src={cat.thumbnailUrl || cat.imageUrl} alt={cat.name} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <FolderTree size={16} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#102B4E]">{cat.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          /{cat.slug}{cat.parentCategory ? ` • Sub of ${cat.parentCategory}` : ''}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">{cat.module}</span>
                  </td>
                  <td className="px-5 py-4">
                    {isDeleted ? (
                      <div className="text-xs text-red-600 font-medium">
                        <p>Deleted {safeFormatDate(cat.deletedAt, 'MMM dd, yyyy HH:mm')}{cat.deletedByName ? ` by ${cat.deletedByName}` : ''}</p>
                        {cat.deleteReason && <p className="text-slate-500 italic">Reason: {cat.deleteReason}</p>}
                      </div>
                    ) : (
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold",
                        count > 0 ? "bg-amber-50 text-amber-700": "bg-emerald-50 text-emerald-700")}>
                        {count} {count === 1 ? 'record': 'records'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      {isDeleted ? (
                        <>
                          {allowRestore && (
                            <button
                              onClick={() => handleRestore(cat)}
                              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 transition-all">
                              <RotateCcw size={14} /> Restore
                            </button>
                          )}
                          {allowPermanent && (
                            <button
                              onClick={() => setPermDeleteTarget(cat)}
                              className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                              <Trash2 size={14} /> Delete Forever
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditing(cat); setFormOpen(true); }}
                            className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg inline-flex items-center gap-1 transition-all">
                            <Edit size={14} /> Edit
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => { setDeleteTarget(cat); setReassignTargetName(''); }}
                              className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-16 text-center text-slate-400 italic">
                  {moduleFilter === 'Deleted'? 'No deleted categories in Trash.': 'No categories created yet. Add custom categories above to manage and organize content.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Single Category Delete with Reassignment Support */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category?" itemName={deleteTarget?.name}
        description={
          targetUsageCount > 0
            ? `This category is currently used by ${targetUsageCount} record(s). Reassign those records to another category before removing it so published content is preserved safely.`
            : `Are you sure you want to delete "${deleteTarget?.name}"? It will be moved to Trash.`
        }
        confirmLabel={targetUsageCount > 0 ? 'Reassign & Move to Trash': 'Move to Trash'}
        allowPermanentOption={allowPermanent}
        disableConfirm={targetUsageCount > 0 && !reassignTargetName}
        extraContent={
          targetUsageCount > 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-800 font-bold">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-amber-600"/>
                <span>{targetUsageCount} record(s) rely on "{deleteTarget?.name}". Select a replacement category:</span>
              </div>
              {availableReassignments.length > 0 ? (
                <div className="flex items-center gap-2">
                  <ArrowRightLeft size={16} className="text-amber-700 flex-shrink-0"/>
                  <select
                    value={reassignTargetName}
                    onChange={e => setReassignTargetName(e.target.value)}
                    className="w-full min-w-0 flex-1 min-h-[42px] p-2.5 bg-white border border-amber-300 rounded-xl text-sm font-medium">
                    <option value="">-- Choose replacement category --</option>
                    {availableReassignments.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-red-700 font-medium">
                  No other {deleteTarget?.module} category exists yet. Create another {deleteTarget?.module} category first to reassign these items.
                </p>
              )}
            </div>
          ) : undefined
        }
      />

      <DeleteConfirmModal
        isOpen={Boolean(permDeleteTarget)}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handleConfirmPermanent}
        title="Permanently Delete Category?" itemName={permDeleteTarget?.name}
        description="This category will be permanently erased from Firestore and cannot be restored." confirmLabel="Delete Forever" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={moduleFilter === 'Deleted'? `Permanently Delete ${selectedIds.size} Deleted Categories?`
          : `Delete ${selectedIds.size} Selected Categories?`}
        description={moduleFilter === 'Deleted'? 'Selected trashed categories will be permanently erased from Firestore.': 'Unused selected categories will be moved to Trash. Any selected categories that are still referenced by active/published records will be skipped so content is never orphaned.'}
        confirmLabel={moduleFilter === 'Deleted'? 'Delete Forever': 'Move to Trash'}
        isPermanent={moduleFilter === 'Deleted'}
        allowPermanentOption={moduleFilter !== 'Deleted'&& allowPermanent}
        requireTypeDelete={moduleFilter === 'Deleted'}
      />
    </div>
  );
}
