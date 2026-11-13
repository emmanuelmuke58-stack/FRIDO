import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { Subscriber } from '../../types';
import { Trash2, Download, CheckCircle2, XCircle, Search } from 'lucide-react';
import { logActivity, permanentDeleteRecord, bulkPermanentDeleteRecords } from '../../lib/services';
import { cn, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import * as XLSX from 'xlsx';
import { useAdminAuth } from './AdminLayout';
import { canDeleteOperationalRecord } from '../../lib/permissions';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAGE_SIZE = 20;

export function NewsletterManagement() {
  const { userProfile } = useAdminAuth();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all'| 'active'| 'unsubscribed'| 'invalid'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [deleteTarget, setDeleteTarget] = useState<Subscriber | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [cleanupMode, setCleanupMode] = useState<'unsubscribed'| 'invalid'| null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const allowDelete = canDeleteOperationalRecord(userProfile);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'subscribers'), orderBy('subscribedAt', 'desc'));
      const snap = await getDocs(q);
      setSubscribers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subscriber)));
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load subscribers.'});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const exportList = () => {
    const data = subscribers.map(s => ({ Email: s.email, Date: safeFormatDate(s.subscribedAt, 'PPP'), Status: s.status }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscribers");
    XLSX.writeFile(wb, "Newsletter_Subscribers.xlsx");
    logActivity('newsletter', 'export', 'Exported newsletter subscribers list');
  };

  const toggleStatus = async (sub: Subscriber) => {
    const newStatus = sub.status === 'active'? 'unsubscribed': 'active';
    try {
      await updateDoc(doc(db, 'subscribers', sub.id), { status: newStatus });
      fetchSubscribers();
    } catch (e) {
      setFeedback({ type: 'error', message: 'Failed to update subscriber status.'});
    }
  };

  const unsubscribedList = subscribers.filter(s => s.status === 'unsubscribed');
  const invalidList = subscribers.filter(s => !EMAIL_REGEX.test(s.email));

  const filteredSubscribers = subscribers.filter(s => {
    const matchesSearch = s.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterMode === 'active') return matchesSearch && s.status === 'active';
    if (filterMode === 'unsubscribed') return matchesSearch && s.status === 'unsubscribed';
    if (filterMode === 'invalid') return matchesSearch && !EMAIL_REGEX.test(s.email);
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredSubscribers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filteredSubscribers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleConfirmSingleDelete = async (reason?: string) => {
    if (!deleteTarget) return;
    try {
      await permanentDeleteRecord('subscribers', deleteTarget.id, deleteTarget.email, 'newsletter', reason);
      setFeedback({ type: 'success', message: `Removed subscriber "${deleteTarget.email}".` });
      setDeleteTarget(null);
      await fetchSubscribers();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to delete subscriber.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkDeleteConfirm = async (reason?: string) => {
    const selected = filteredSubscribers.filter(s => selectedIds.has(s.id));
    const res = await bulkPermanentDeleteRecords(
      'subscribers',
      selected.map(s => ({ id: s.id, title: s.email })),
      'newsletter',
      reason
    );
    setFeedback({
      type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Deleted ${res.succeeded} subscriber(s).${res.failed > 0 ? ` ${res.failed} failed.` : ''}`,
      details: res.errors,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete selected subscribers.');
    }
    setSelectedIds(new Set());
    await fetchSubscribers();
  };

  const handleCleanupConfirm = async (reason?: string) => {
    const targets = cleanupMode === 'unsubscribed'? unsubscribedList : invalidList;
    const res = await bulkPermanentDeleteRecords(
      'subscribers',
      targets.map(s => ({ id: s.id, title: s.email })),
      'newsletter',
      reason || `Cleanup ${cleanupMode} subscribers`
    );
    setFeedback({
      type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Cleaned up ${res.succeeded} ${cleanupMode} subscriber record(s).`,
      details: res.errors,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to clean up subscribers.');
    }
    setCleanupMode(null);
    await fetchSubscribers();
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Loading subscribers...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Newsletter Management</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage subscribers, remove unsubscribed or invalid records, and export mailing lists.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          {allowDelete && unsubscribedList.length > 0 && (
            <button
              onClick={() => setCleanupMode('unsubscribed')}
              className="min-h-[44px] px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
              <Trash2 size={15} /> Purge Unsubscribed ({unsubscribedList.length})
            </button>
          )}
          {allowDelete && invalidList.length > 0 && (
            <button
              onClick={() => setCleanupMode('invalid')}
              className="min-h-[44px] px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
              <Trash2 size={15} /> Clean Invalid ({invalidList.length})
            </button>
          )}
          <button
            onClick={exportList}
            className="w-full sm:w-auto min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all">
            <Download size={18} /> Export List
          </button>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search by email..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-all" value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'all', label: `All (${subscribers.length})` },
            { id: 'active', label: 'Active'},
            { id: 'unsubscribed', label: `Unsubscribed (${unsubscribedList.length})` },
            { id: 'invalid', label: `Invalid (${invalidList.length})` },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => { setFilterMode(f.id); setCurrentPage(1); setSelectedIds(new Set()); }}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                filterMode === f.id ? "bg-[#083D91] text-white": "bg-slate-50 text-slate-500 hover:bg-slate-100")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={paginated.length}
        totalFilteredCount={filteredSubscribers.length}
        allFilteredSelected={selectedIds.size === filteredSubscribers.length && filteredSubscribers.length > 0}
        onSelectPage={(checked) => {
          const next = new Set(selectedIds);
          paginated.forEach(s => checked ? next.add(s.id) : next.delete(s.id));
          setSelectedIds(next);
        }}
        onSelectAllFiltered={() => setSelectedIds(new Set(filteredSubscribers.map(s => s.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        canDelete={allowDelete}
      />

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {paginated.map((sub) => (
          <div key={sub.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={selectedIds.has(sub.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(sub.id)) next.delete(sub.id);
                    else next.add(sub.id);
                    setSelectedIds(next);
                  }}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-[#083D91] flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 break-all">{sub.email}</p>
                  {!EMAIL_REGEX.test(sub.email) && (
                    <span className="text-[10px] font-bold text-red-500 block mt-0.5">Invalid email syntax</span>
                  )}
                  <p className="text-xs text-slate-400 mt-1">Subscribed {safeFormatDate(sub.subscribedAt, 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                sub.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
              )}>
                {sub.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2.5 border-t border-slate-100">
              <button
                onClick={() => toggleStatus(sub)}
                className={cn(
                  "min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all",
                  sub.status === 'active' ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                {sub.status === 'active' ? <XCircle size={15} /> : <CheckCircle2 size={15} />}
                {sub.status === 'active' ? 'Unsubscribe' : 'Activate'}
              </button>
              {allowDelete && (
                <button
                  onClick={() => setDeleteTarget(sub)}
                  className="min-h-[40px] px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                >
                  <Trash2 size={14} /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredSubscribers.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center text-slate-400 italic">No subscribers found.</div>
        )}
      </div>

      {/* Tablet & Desktop Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="w-10 px-5 py-4"></th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subscribed On</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paginated.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-4">
                  <input
                    type="checkbox" checked={selectedIds.has(sub.id)}
                    onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(sub.id)) next.delete(sub.id);
                      else next.add(sub.id);
                      setSelectedIds(next);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-[#083D91]"/>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm font-bold text-slate-900 break-all">{sub.email}</p>
                  {!EMAIL_REGEX.test(sub.email) && (
                    <span className="text-[10px] font-bold text-red-500">Invalid email syntax</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {safeFormatDate(sub.subscribedAt, 'MMM dd, yyyy')}
                </td>
                <td className="px-5 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    sub.status === 'active'? "bg-emerald-50 text-emerald-600": "bg-slate-100 text-slate-400")}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => toggleStatus(sub)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        sub.status === 'active'? "text-amber-500 hover:bg-amber-50": "text-emerald-500 hover:bg-emerald-50")}
                      title={sub.status === 'active'? 'Unsubscribe': 'Activate'}
                    >
                      {sub.status === 'active'? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    </button>
                    {allowDelete && (
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredSubscribers.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic">No subscribers found.</div>
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
        title="Delete Subscriber?" itemName={deleteTarget?.email}
        description="Permanently remove this subscriber from the mailing list?" confirmLabel="Delete Subscriber"isPermanent
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} Selected Subscribers?`}
        description="Selected subscribers will be permanently removed from the mailing list." confirmLabel={`Delete ${selectedIds.size} Subscribers`}
        isPermanent
        requireTypeDelete={selectedIds.size > 10}
      />

      <DeleteConfirmModal
        isOpen={Boolean(cleanupMode)}
        onClose={() => setCleanupMode(null)}
        onConfirm={handleCleanupConfirm}
        title={cleanupMode === 'unsubscribed'? `Purge ${unsubscribedList.length} Unsubscribed Records?` : `Clean ${invalidList.length} Invalid Email Records?`}
        description="This will permanently delete all matching records from the subscriber list." confirmLabel="Confirm Purge"isPermanent
        requireTypeDelete
      />
    </div>
  );
}
