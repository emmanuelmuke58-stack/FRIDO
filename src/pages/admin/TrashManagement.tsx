import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import {
  Trash2, RotateCcw, Search, Clock, ShieldAlert, Sparkles
} from 'lucide-react';
import {
  logActivity, restoreRecord, permanentDeleteRecord, bulkPermanentDeleteRecords, notifyTrashUpdated
} from '../../lib/services';
import { useSettings } from '../../lib/SettingsContext';
import { useAdminAuth } from './AdminLayout';
import { canPermanentDelete, canRestoreContent } from '../../lib/permissions';
import { cn, safeDate, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import { differenceInDays, addDays } from 'date-fns';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';

type TrashCollection = 'news'| 'opportunities'| 'pages'| 'categories';

interface TrashItem {
  id: string;
  collectionName: TrashCollection;
  moduleLabel: string;
  logModule: any;
  title: string;
  previousStatus?: string;
  fallbackStatus: string;
  deletedAt: string;
  deletedByName?: string;
  deleteReason?: string;
}

export function TrashManagement() {
  const { settings } = useSettings();
  const { userProfile } = useAdminAuth();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [permTarget, setPermTarget] = useState<TrashItem | null>(null);
  const [bulkPermOpen, setBulkPermOpen] = useState(false);
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false);

  const retentionDays = settings.trashRetentionDays || 30;
  const allowPermanent = canPermanentDelete(userProfile);
  const allowRestore = canRestoreContent(userProfile);

  const fetchTrash = async () => {
    setLoading(true);
    try {
      const [newsSnap, oppsSnap, pagesSnap, catsSnap] = await Promise.all([
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'opportunities')),
        getDocs(collection(db, 'pages')),
        getDocs(collection(db, 'categories')),
      ]);

      const combined: TrashItem[] = [];

      newsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'deleted') {
          combined.push({
            id: d.id,
            collectionName: 'news',
            moduleLabel: 'News',
            logModule: 'news',
            title: data.headline || 'Untitled Article',
            previousStatus: data.previousStatus,
            fallbackStatus: 'draft',
            deletedAt: data.deletedAt || data.publishedAt || new Date().toISOString(),
            deletedByName: data.deletedByName,
            deleteReason: data.deleteReason,
          });
        }
      });

      oppsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'deleted') {
          const mod = data.category || 'Others';
          combined.push({
            id: d.id,
            collectionName: 'opportunities',
            moduleLabel: mod,
            logModule: mod === 'Others'? 'opportunities': mod.toLowerCase(),
            title: data.title || 'Untitled Opportunity',
            previousStatus: data.previousStatus,
            fallbackStatus: 'draft',
            deletedAt: data.deletedAt || data.createdAt || new Date().toISOString(),
            deletedByName: data.deletedByName,
            deleteReason: data.deleteReason,
          });
        }
      });

      pagesSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'deleted') {
          combined.push({
            id: d.id,
            collectionName: 'pages',
            moduleLabel: 'Pages',
            logModule: 'pages',
            title: data.title || data.slug || 'Untitled Page',
            previousStatus: data.previousStatus,
            fallbackStatus: 'draft',
            deletedAt: data.deletedAt || data.lastUpdated || new Date().toISOString(),
            deletedByName: data.deletedByName,
            deleteReason: data.deleteReason,
          });
        }
      });

      catsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'deleted') {
          combined.push({
            id: d.id,
            collectionName: 'categories',
            moduleLabel: 'Categories',
            logModule: 'categories',
            title: `${data.name} (${data.module})`,
            previousStatus: data.previousStatus,
            fallbackStatus: 'active',
            deletedAt: data.deletedAt || data.createdAt || new Date().toISOString(),
            deletedByName: data.deletedByName,
            deleteReason: data.deleteReason,
          });
        }
      });

      combined.sort((a, b) => {
        const ta = safeDate(a.deletedAt)?.getTime() ?? 0;
        const tb = safeDate(b.deletedAt)?.getTime() ?? 0;
        return tb - ta;
      });
      setItems(combined);
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to load Trash items.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrash();
  }, []);

  const moduleCounts = React.useMemo(() => {
    const counts: Record<string, number> = { All: items.length };
    for (const item of items) {
      counts[item.moduleLabel] = (counts[item.moduleLabel] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = items.filter(item => {
    const matchesMod = moduleFilter === 'All'|| item.moduleLabel === moduleFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.deletedByName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.deleteReason || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesMod && matchesSearch;
  });

  const getKey = (item: TrashItem) => `${item.collectionName}:${item.id}`;

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreRecord(
        item.collectionName,
        item.id,
        item.fallbackStatus,
        item.previousStatus,
        item.title,
        item.logModule
      );
      setFeedback({ type: 'success', message: `Restored "${item.title}" to ${item.moduleLabel}.` });
      fetchTrash();
    } catch (err: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(err, 'Permission denied restoring record.') });
    }
  };

  const handleBulkRestore = async () => {
    const targets = filtered.filter(i => selectedIds.has(getKey(i)));
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const item of targets) {
      try {
        await restoreRecord(
          item.collectionName,
          item.id,
          item.fallbackStatus,
          item.previousStatus,
          item.title,
          item.logModule
        );
        succeeded++;
      } catch (err: any) {
        failed++;
        errors.push(`${item.title}: ${extractErrorMessage(err, 'Restore failed')}`);
      }
    }
    setFeedback({
      type: failed > 0 ? (succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Restored ${succeeded} record(s).${failed > 0 ? ` ${failed} failed.` : ''}`,
      details: errors,
    });
    setSelectedIds(new Set());
    fetchTrash();
  };

  const handlePermanentDelete = async (reason?: string) => {
    if (!permTarget) return;
    try {
      await permanentDeleteRecord(
        permTarget.collectionName,
        permTarget.id,
        permTarget.title,
        permTarget.logModule,
        reason
      );
      setFeedback({ type: 'success', message: `Permanently deleted "${permTarget.title}".` });
      setPermTarget(null);
      await fetchTrash();
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to permanently delete record.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkPermanentDelete = async (reason?: string) => {
    const targets = filtered.filter(i => selectedIds.has(getKey(i)));
    const byCol = new Map<TrashCollection, TrashItem[]>();
    targets.forEach(t => {
      const list = byCol.get(t.collectionName) || [];
      list.push(t);
      byCol.set(t.collectionName, list);
    });

    let totalOk = 0;
    let totalErr = 0;
    const allErrs: string[] = [];

    for (const [col, colItems] of byCol.entries()) {
      const res = await bulkPermanentDeleteRecords(
        col,
        colItems.map(c => ({ id: c.id, title: c.title })),
        'trash',
        reason
      );
      totalOk += res.succeeded;
      totalErr += res.failed;
      allErrs.push(...res.errors);
    }

    setFeedback({
      type: totalErr > 0 ? (totalOk > 0 ? 'warning': 'error') : 'success',
      message: `Permanently deleted ${totalOk} record(s).${totalErr > 0 ? ` ${totalErr} failed.` : ''}`,
      details: allErrs,
    });
    if (totalOk === 0 && totalErr > 0) {
      throw new Error(allErrs[0] || 'Failed to delete selected records.');
    }
    setSelectedIds(new Set());
    await fetchTrash();
  };

  const handleEmptyTrash = async (reason?: string) => {
    let ok = 0;
    let fail = 0;
    const errors: string[] = [];
    for (const item of items) {
      try {
        await deleteDoc(doc(db, item.collectionName, item.id));
        ok++;
      } catch (err: any) {
        fail++;
        errors.push(`${item.title}: ${extractErrorMessage(err, 'Permission denied')}`);
      }
    }
    if (ok > 0) {
      notifyTrashUpdated();
      await logActivity('trash', 'empty_trash', `Emptied Trash (${ok} permanently deleted, ${fail} failed)`, null, {
        recordType: 'trash',
        recordTitle: `${ok} records`,
        deletionType: 'empty_trash',
        reason,
      });
    }
    setFeedback({
      type: fail > 0 ? (ok > 0 ? 'warning': 'error') : 'success',
      message: `Emptied Trash: ${ok} record(s) permanently deleted.${fail > 0 ? ` ${fail} failed.` : ''}`,
      details: errors,
    });
    if (ok === 0 && fail > 0) {
      throw new Error(errors[0] || 'Failed to empty Trash.');
    }
    setSelectedIds(new Set());
    await fetchTrash();
  };

  const expiredItems = items.filter(i => {
    const deletedDate = safeDate(i.deletedAt);
    if (!deletedDate) return false;
    const purgeDate = addDays(deletedDate, retentionDays);
    return new Date() >= purgeDate;
  });

  const handlePurgeExpired = async () => {
    let ok = 0;
    let fail = 0;
    const errors: string[] = [];
    for (const item of expiredItems) {
      try {
        await deleteDoc(doc(db, item.collectionName, item.id));
        ok++;
      } catch (err: any) {
        fail++;
        errors.push(`${item.title}: ${extractErrorMessage(err, 'Permission denied')}`);
      }
    }
    if (ok > 0) {
      notifyTrashUpdated();
      await logActivity('trash', 'purge', `Purged ${ok} expired Trash record(s) past ${retentionDays}-day retention`, null, {
        recordType: 'trash',
        recordTitle: `${ok} expired items`,
        deletionType: 'purge',
      });
    }
    setFeedback({
      type: fail > 0 ? (ok > 0 ? 'warning': 'error') : 'success',
      message: `Purged ${ok} expired Trash item(s).${fail > 0 ? ` ${fail} failed.` : ''}`,
      details: errors,
    });
    fetchTrash();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Trash / What Was Deleted</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Inspect every deleted record across the platform. Items stay recoverable for <strong>{retentionDays} days</strong> before permanent purge.
          </p>
        </div>

        {allowPermanent && items.length > 0 && (
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {expiredItems.length > 0 && (
              <button
                onClick={handlePurgeExpired}
                className="min-h-[44px] px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
                <Sparkles size={16} /> Purge Expired ({expiredItems.length})
              </button>
            )}
            <button
              onClick={() => setEmptyTrashOpen(true)}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all">
              <Trash2 size={16} /> Empty Trash ({items.length})
            </button>
          </div>
        )}
      </div>

      {!allowPermanent && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start sm:items-center gap-3 text-xs text-[#083D91] font-medium">
          <ShieldAlert size={18} className="flex-shrink-0 mt-0.5 sm:mt-0"/>
          <span>
            Viewing deleted records. {allowRestore ? 'You can restore deleted items below. ' : ''}Only <strong>Super Administrators</strong> can permanently erase records or empty the Trash.
          </span>
        </div>
      )}

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search deleted content by title, admin, or reason..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['All', 'News', 'Jobs', 'Scholarships', 'Tenders', 'Others', 'Pages', 'Categories'].map(m => (
            <button
              key={m}
              onClick={() => { setModuleFilter(m); setSelectedIds(new Set()); }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                moduleFilter === m ? "bg-[#083D91] text-white": "bg-slate-50 text-slate-500 hover:bg-slate-100")}
            >
              {m} ({moduleCounts[m] || 0})
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={filtered.length}
        totalFilteredCount={filtered.length}
        allFilteredSelected={selectedIds.size === filtered.length && filtered.length > 0}
        onSelectPage={(checked) => setSelectedIds(checked ? new Set(filtered.map(getKey)) : new Set())}
        onSelectAllFiltered={() => setSelectedIds(new Set(filtered.map(getKey)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkRestore={allowRestore ? handleBulkRestore : undefined}
        onBulkDelete={() => setBulkPermOpen(true)}
        bulkDeleteLabel="Permanently Delete" canDelete={allowPermanent}
      />

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-400">Loading Trash...</div>
        ) : filtered.map(item => {
          const key = getKey(item);
          const parsedDel = safeDate(item.deletedAt) || new Date();
          const purgeDate = addDays(parsedDel, retentionDays);
          const daysLeft = Math.max(0, differenceInDays(purgeDate, new Date()));

          return (
            <div key={key} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                <input
                  type="checkbox" checked={selectedIds.has(key)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    setSelectedIds(next);
                  }}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-[#083D91] flex-shrink-0"/>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
                      {item.moduleLabel}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1",
                      daysLeft <= 3 ? "bg-red-50 text-red-600": "bg-amber-50 text-amber-700")}>
                      <Clock size={10} /> {daysLeft === 0 ? 'Eligible for purge': `${daysLeft}d retention left`}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#102B4E] line-clamp-2 sm:truncate">{item.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 break-words">
                    Deleted {safeFormatDate(item.deletedAt, 'MMM dd, yyyy HH:mm')}
                    {item.deletedByName ? ` by ${item.deletedByName}` : ''}
                    {item.deleteReason ? ` • Reason: ${item.deleteReason}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 flex-shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {allowRestore && (
                  <button
                    onClick={() => handleRestore(item)}
                    className="min-h-[40px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all">
                    <RotateCcw size={14} /> Restore
                  </button>
                )}
                {allowPermanent && (
                  <button
                    onClick={() => setPermTarget(item)}
                    className="min-h-[40px] px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all">
                    <Trash2 size={14} /> Delete Forever
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            Trash is empty. Deleted items will appear here for safe recovery.
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(permTarget)}
        onClose={() => setPermTarget(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Record?" itemName={permTarget?.title}
        description={`You are about to permanently remove this ${permTarget?.moduleLabel} record from Firestore.`}
        confirmLabel="Permanently Delete" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkPermOpen}
        onClose={() => setBulkPermOpen(false)}
        onConfirm={handleBulkPermanentDelete}
        title={`Permanently Delete ${selectedIds.size} Records?`}
        description="All selected Trash items will be permanently removed from Firestore." confirmLabel="Permanently Delete Selected" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrash}
        title={`Empty Trash (${items.length} Records)?`}
        description="This will permanently erase every item currently inside Trash across all modules." confirmLabel="Empty Trash" isPermanent
        requireTypeDelete
      />
    </div>
  );
}
