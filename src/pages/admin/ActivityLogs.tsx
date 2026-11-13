import React from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { format, subDays } from 'date-fns';
import { Search, Shield, User, Clock, Terminal, Trash2, Download, ShieldAlert } from 'lucide-react';
import { cn, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import { ActivityLog } from '../../types';
import { useAdminAuth } from './AdminLayout';
import { canManageUsersOrSettings } from '../../lib/permissions';
import { logActivity } from '../../lib/services';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import * as XLSX from 'xlsx';

export function ActivityLogs() {
  const { userProfile } = useAdminAuth();
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<'all'| 'deletions'>('all');
  const [retentionDays, setRetentionDays] = React.useState<number>(90);
  const [purgeOpen, setPurgeOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null);

  const isSuperAdmin = canManageUsersOrSettings(userProfile);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(200));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-emerald-600 bg-emerald-50';
      case 'restore': return 'text-teal-600 bg-teal-50';
      case 'delete':
      case 'permanent_delete':
      case 'bulk_delete':
      case 'empty_trash':
      case 'purge':
        return 'text-red-600 bg-red-50';
      case 'edit': return 'text-amber-600 bg-amber-50';
      case 'login': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const filteredLogs = logs.filter(l => {
    const matchesSearch =
      (l.adminName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.recordTitle || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.module || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (actionFilter === 'deletions') {
      return matchesSearch && ['delete', 'permanent_delete', 'bulk_delete', 'empty_trash', 'purge', 'restore'].includes(l.action);
    }
    return matchesSearch;
  });

  const exportArchive = () => {
    const ws = XLSX.utils.json_to_sheet(filteredLogs.map(l => ({
      Timestamp: l.timestamp,
      AdminId: l.adminId,
      AdminName: l.adminName,
      Module: l.module,
      Action: l.action,
      DeletionType: l.deletionType || '',
      RecordType: l.recordType || '',
      RecordId: l.targetId || '',
      RecordTitle: l.recordTitle || '',
      Reason: l.reason || '',
      Details: l.details || '',
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AuditLogs');
    XLSX.writeFile(wb, `Admin_Audit_Archive_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const handleRetentionPurge = async (reason?: string) => {
    try {
      const snap = await getDocs(collection(db, 'activityLogs'));
      const cutoff = subDays(new Date(), retentionDays);
      const oldDocs = snap.docs.filter(d => {
        const ts = d.data().timestamp;
        return ts && new Date(ts) < cutoff;
      });

      let deleted = 0;
      for (const d of oldDocs) {
        await deleteDoc(doc(db, 'activityLogs', d.id));
        deleted++;
      }

      await logActivity('settings', 'purge', `Archived & purged ${deleted} audit log(s) older than ${retentionDays} days`, null, {
        recordType: 'activityLogs',
        recordTitle: `${deleted} archived logs`,
        deletionType: 'purge',
        reason,
      });

      setFeedback({ type: 'success', message: `Purged ${deleted} audit log(s) older than ${retentionDays} days.` });
      await fetchLogs();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Only Super Administrators can purge archived audit logs.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Admin Activity Logs</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Immutable audit trail of all creations, edits, soft deletions, restorations, and permanent deletions.</p>
        </div>
        <button
          onClick={exportArchive}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 shadow-sm">
          <Download size={16} /> Export Audit Archive
        </button>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Super Admin Log Retention Controls */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3 text-xs text-slate-600">
          <ShieldAlert size={18} className="text-[#083D91] flex-shrink-0 mt-0.5 sm:mt-0"/>
          <span>
            Audit logs cannot be modified or deleted by ordinary administrators.
            {isSuperAdmin ? ' Super Admin retention controls enabled.' : ' Read-only view.'}
          </span>
        </div>
        {isSuperAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={retentionDays}
              onChange={e => setRetentionDays(Number(e.target.value))}
              className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">
              <option value={30}>Older than 30 days</option>
              <option value={90}>Older than 90 days</option>
              <option value={180}>Older than 180 days</option>
            </select>
            <button
              onClick={() => setPurgeOpen(true)}
              className="min-h-[40px] px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <Trash2 size={14} /> Purge Archived Logs
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search by admin name, record title, module or action..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActionFilter('all')}
            className={cn("min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold", actionFilter === 'all'? "bg-[#083D91] text-white": "bg-slate-50 text-slate-500")}
          >
            All Events
          </button>
          <button
            onClick={() => setActionFilter('deletions')}
            className={cn("min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold", actionFilter === 'deletions'? "bg-red-600 text-white": "bg-slate-50 text-slate-500")}
          >
            Deletions & Restores
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start gap-4 sm:gap-5 hover:shadow-md transition-all">
            <div className={cn("p-2.5 sm:p-3 rounded-xl flex-shrink-0", getActionColor(log.action))}>
              <Terminal size={20} />
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-1.5">
                <span className="text-sm font-bold text-[#102B4E] break-all">{log.adminName || log.adminId}</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", getActionColor(log.action))}>
                  {log.deletionType ? log.deletionType.replace(/_/g, ' ') : log.action.replace(/_/g, ' ')}
                </span>
                {log.recordTitle && (
                  <span className="text-xs font-semibold text-slate-700 break-words">
                    — {log.recordTitle}
                  </span>
                )}
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest sm:ml-auto flex items-center gap-1">
                  <Clock size={12} /> {safeFormatDate(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                </span>
              </div>
              <p className="text-sm text-slate-600 break-words">{log.details}</p>
              {log.reason && (
                <p className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg mt-2 inline-block break-words">
                  <strong>Reason:</strong> {log.reason}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><Shield size={12} /> Module: {log.recordType || log.module}</span>
                <span className="flex items-center gap-1.5 break-all"><User size={12} className="flex-shrink-0" /> Admin ID: {log.adminId}</span>
                {log.targetId && <span className="font-mono break-all">Record ID: {log.targetId}</span>}
              </div>
            </div>
          </div>
        ))}

        {filteredLogs.length === 0 && !loading && (
          <div className="bg-white p-12 sm:p-20 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            No activity logs found.
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={purgeOpen}
        onClose={() => setPurgeOpen(false)}
        onConfirm={handleRetentionPurge}
        title={`Purge Logs Older Than ${retentionDays} Days?`}
        description="Tip: Export the Audit Archive before purging. This permanently removes archived log records older than the selected retention period." confirmLabel="Purge Archived Logs" isPermanent
        requireTypeDelete
        reasonRequired
      />
    </div>
  );
}
