import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, query, addDoc, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  FileDown, Download, Printer, Filter, BookmarkPlus, Trash2, ShieldAlert, FileSpreadsheet
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn, safeFormatDate, extractErrorMessage } from '../../lib/utils';
import { SavedReport } from '../../types';
import { useAdminAuth } from './AdminLayout';
import { canDeleteOperationalRecord, canDeleteOperationalRecord as canDeleteReports, canManageUsersOrSettings } from '../../lib/permissions';
import { logActivity, permanentDeleteRecord, bulkPermanentDeleteRecords } from '../../lib/services';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';

export function ReportsPage() {
  const { userProfile } = useAdminAuth();
  const [dateRange, setDateRange] = React.useState('7d');
  const [customStart, setCustomStart] = React.useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = React.useState(true);
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [summary, setSummary] = React.useState({
    news: 0,
    jobs: 0,
    scholarships: 0,
    tenders: 0,
    views: 0
  });
  const [topContent, setTopContent] = React.useState<any[]>([]);
  const [savedReports, setSavedReports] = React.useState<SavedReport[]>([]);
  const [selectedReportIds, setSelectedReportIds] = React.useState<Set<string>>(new Set());
  const [reportTitle, setReportTitle] = React.useState('');

  const [deleteReportTarget, setDeleteReportTarget] = React.useState<SavedReport | null>(null);
  const [bulkDeleteReportsOpen, setBulkDeleteReportsOpen] = React.useState(false);

  // Super Admin Analytics Retention state
  const [analyticsPurgeDays, setAnalyticsPurgeDays] = React.useState<number>(90);
  const [analyticsPurgeOpen, setAnalyticsPurgeOpen] = React.useState(false);
  const [totalAnalyticsCount, setTotalAnalyticsCount] = React.useState(0);
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null);

  const isSuperAdmin = canManageUsersOrSettings(userProfile);
  const canDeleteSavedReports = canDeleteReports(userProfile);

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date = new Date();

      if (dateRange === 'custom') {
        startDate = startOfDay(new Date(customStart));
        endDate = endOfDay(new Date(customEnd));
      } else {
        const days = dateRange === '7d'? 7 : dateRange === '30d'? 30 : 90;
        startDate = subDays(new Date(), days);
      }

      const [newsSnap, oppsSnap, savedSnap, allAnalyticsSnap] = await Promise.all([
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'opportunities')),
        getDocs(query(collection(db, 'savedReports'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'analytics')),
      ]);

      const newsDocs = newsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((n: any) => n.status !== 'deleted');
      const oppsDocs = oppsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter((o: any) => o.status !== 'deleted');
      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();
      const analytics = allAnalyticsSnap.docs
        .map(d => d.data())
        .filter((a: any) => a.timestamp && a.timestamp >= startIso && a.timestamp <= endIso);

      setTotalAnalyticsCount(allAnalyticsSnap.size);
      setSavedReports(savedSnap.docs.map(d => ({ id: d.id, ...d.data() } as SavedReport)));

      setSummary({
        news: newsDocs.length,
        jobs: oppsDocs.filter((o: any) => o.category === 'Jobs').length,
        scholarships: oppsDocs.filter((o: any) => o.category === 'Scholarships').length,
        tenders: oppsDocs.filter((o: any) => o.category === 'Tenders').length,
        views: analytics.length
      });

      const allContent = [...newsDocs, ...oppsDocs].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 6);
      setTopContent(allContent);

      const chartData: any[] = [];
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = diffDays; i >= 0; i--) {
        const d = subDays(endDate, i);
        const dayLabel = format(d, 'MMM dd');
        const dayViews = analytics.filter(a => safeFormatDate(a.timestamp, 'yyyy-MM-dd', '') === format(d, 'yyyy-MM-dd')).length;
        chartData.push({ name: dayLabel, views: dayViews });
      }
      setReportData(chartData);
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load analytics data.'});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateRange, customStart, customEnd]);

  const saveReportSnapshot = async (fmt: SavedReport['format'] = 'snapshot') => {
    const user = auth.currentUser;
    if (!user) return;
    const title = reportTitle.trim() || `Traffic & Content Report (${dateRange.toUpperCase()}) - ${format(new Date(), 'MMM dd, yyyy')}`;
    try {
      await addDoc(collection(db, 'savedReports'), {
        title,
        dateRange,
        startDate: customStart,
        endDate: customEnd,
        format: fmt,
        totalViews: summary.views,
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Admin',
        createdAt: new Date().toISOString(),
      });
      await logActivity('reports', 'create', `Saved report configuration: ${title}`);
      setReportTitle('');
      setFeedback({ type: 'success', message: `Saved report "${title}".` });
      fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to save report.'});
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Traffic Report");
    XLSX.writeFile(wb, `Rwanda_Opportunities_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    saveReportSnapshot('xlsx');
  };

  const exportToPDF = () => {
    const docPdf = new jsPDF() as any;
    docPdf.text("Rwanda Opportunities - Performance Report", 14, 15);
    docPdf.setFontSize(10);
    docPdf.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 25);
    docPdf.text(`Period: Last ${dateRange}`, 14, 30);

    docPdf.autoTable({
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total News', summary.news],
        ['Total Jobs', summary.jobs],
        ['Total Scholarships', summary.scholarships],
        ['Total Tenders', summary.tenders],
        ['Total Page Views', summary.views]
      ],
      theme: 'grid',
      headStyles: { fillColor: [8, 61, 145] }
    });

    docPdf.save(`Rwanda_Report_${dateRange}.pdf`);
    saveReportSnapshot('pdf');
  };

  const handleDeleteSavedReport = async (reason?: string) => {
    if (!deleteReportTarget) return;
    try {
      await permanentDeleteRecord('savedReports', deleteReportTarget.id, deleteReportTarget.title, 'reports', reason);
      setFeedback({ type: 'success', message: `Deleted saved report "${deleteReportTarget.title}".` });
      setDeleteReportTarget(null);
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to delete saved report.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkDeleteReports = async (reason?: string) => {
    const selected = savedReports.filter(r => selectedReportIds.has(r.id));
    const res = await bulkPermanentDeleteRecords(
      'savedReports',
      selected.map(r => ({ id: r.id, title: r.title })),
      'reports',
      reason
    );
    setFeedback({
      type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Deleted ${res.succeeded} saved report(s).`,
      details: res.errors,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete selected reports.');
    }
    setSelectedReportIds(new Set());
    await fetchData();
  };

  const handlePurgeAnalytics = async (reason?: string) => {
    try {
      const snap = await getDocs(collection(db, 'analytics'));
      const cutoff = analyticsPurgeDays === 0 ? new Date(Date.now() + 10000) : subDays(new Date(), analyticsPurgeDays);
      const eligible = snap.docs.filter(d => {
        const ts = d.data().timestamp;
        return !ts || new Date(ts) <= cutoff;
      });

      let deleted = 0;
      for (const d of eligible) {
        await deleteDoc(doc(db, 'analytics', d.id));
        deleted++;
      }

      await logActivity('reports', 'purge', `Purged ${deleted} analytics record(s) (${analyticsPurgeDays === 0 ? 'All': `older than ${analyticsPurgeDays} days`})`, null, {
        recordType: 'analytics',
        recordTitle: `${deleted} events`,
        deletionType: 'purge',
        reason,
      });

      setFeedback({ type: 'success', message: `Purged ${deleted} historical analytics event(s).` });
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Only Super Admins can purge historical analytics records.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-bottom-4 duration-700 pb-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Generate insights, manage saved report configurations/exports, and administer analytics retention.</p>
        </div>
        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          <button onClick={exportToPDF} className="min-h-[44px] flex-1 sm:flex-initial justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm text-xs sm:text-sm">
            <FileDown size={18} /> Export PDF
          </button>
          <button onClick={exportToExcel} className="min-h-[44px] flex-1 sm:flex-initial justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-teal-500 hover:bg-teal-600 rounded-xl font-bold text-white transition-all shadow-lg shadow-teal-500/20 text-xs sm:text-sm">
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Control Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto scrollbar-hide">
          {['7d', '30d', '90d', 'custom'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "min-h-[40px] whitespace-nowrap px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0",
                dateRange === range ? "bg-[#083D91] text-white": "text-slate-500 hover:bg-slate-50")}
            >
              {range === '7d'? 'Last 7 Days': range === '30d'? 'Last 30 Days': range === '90d'? 'Last 3 Months': 'Custom Range'}
            </button>
          ))}
        </div>

        {dateRange === 'custom'&& (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto">
            <input type="date" className="flex-1 min-w-[125px] min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="text-slate-400 text-xs">to</span>
            <input type="date" className="flex-1 min-w-[125px] min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button onClick={fetchData} aria-label="Apply date range" className="min-h-[40px] min-w-[40px] flex items-center justify-center p-2.5 bg-[#083D91] text-white rounded-xl shrink-0">
              <Filter size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm min-w-0">
          <h3 className="font-bold text-base sm:text-lg mb-5 sm:mb-8">Traffic Intensity</h3>
          <div className="h-[260px] sm:h-[340px] lg:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} allowDecimals={false} width={32} />
                <Tooltip cursor={{ fill: '#F8FAFC'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="views" fill="#14B8A6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm min-w-0">
          <h3 className="font-bold text-base sm:text-lg mb-5 sm:mb-8">Performance Summary</h3>
          <div className="space-y-4 sm:space-y-6">
            {[
              { label: 'Published News', value: summary.news, color: 'bg-blue-50 text-blue-600'},
              { label: 'Active Jobs', value: summary.jobs, color: 'bg-teal-50 text-teal-600'},
              { label: 'Total Scholarships', value: summary.scholarships, color: 'bg-indigo-50 text-indigo-600'},
              { label: 'Active Tenders', value: summary.tenders, color: 'bg-amber-50 text-amber-600'},
              { label: 'Total Page Views', value: summary.views, color: 'bg-purple-50 text-purple-600'}
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-2 pb-4 sm:pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold shrink-0", item.color)}>
                    {item.label[0]}
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-slate-600 truncate">{item.label}</span>
                </div>
                <span className="text-base sm:text-lg font-bold text-[#102B4E] tabular-nums shrink-0">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button onClick={() => window.print()} className="min-h-[44px] w-full mt-6 sm:mt-8 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
            <Printer size={18} /> Print Full Report
          </button>
        </div>
      </div>

      {/* Saved Reports & Exports */}
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base sm:text-lg text-[#102B4E]">Saved Report Configurations & Exports</h3>
            <p className="text-xs text-slate-500 mt-0.5">Save current filter configurations or clean up obsolete report exports.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <input
              type="text" placeholder="Report configuration title..." value={reportTitle}
              onChange={e => setReportTitle(e.target.value)}
              className="min-w-0 flex-1 sm:w-64 min-h-[42px] px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"/>
            <button
              onClick={() => saveReportSnapshot('snapshot')}
              className="min-h-[42px] px-4 py-2 bg-[#083D91] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shrink-0">
              <BookmarkPlus size={16} /> Save Config
            </button>
          </div>
        </div>

        <BulkActionBar
          selectedCount={selectedReportIds.size}
          pageCount={savedReports.length}
          totalFilteredCount={savedReports.length}
          allFilteredSelected={selectedReportIds.size === savedReports.length && savedReports.length > 0}
          onSelectPage={(checked) => setSelectedReportIds(checked ? new Set(savedReports.map(r => r.id)) : new Set())}
          onSelectAllFiltered={() => setSelectedReportIds(new Set(savedReports.map(r => r.id)))}
          onClearSelection={() => setSelectedReportIds(new Set())}
          onBulkDelete={() => setBulkDeleteReportsOpen(true)}
          canDelete={canDeleteSavedReports}
        />

        <div className="divide-y divide-slate-100">
          {savedReports.map(rep => (
            <div key={rep.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox" checked={selectedReportIds.has(rep.id)}
                  onChange={() => {
                    const next = new Set(selectedReportIds);
                    if (next.has(rep.id)) next.delete(rep.id);
                    else next.add(rep.id);
                    setSelectedReportIds(next);
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-[#083D91]"/>
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#102B4E]">{rep.title}</p>
                  <p className="text-xs text-slate-400">
                    Range: {rep.dateRange} • Format: {rep.format.toUpperCase()} • {rep.totalViews ?? 0} views • Saved {safeFormatDate(rep.createdAt, 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => {
                    setDateRange(rep.dateRange);
                    if (rep.startDate) setCustomStart(rep.startDate);
                    if (rep.endDate) setCustomEnd(rep.endDate);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold">
                  Load
                </button>
                {canDeleteSavedReports && (
                  <button
                    onClick={() => setDeleteReportTarget(rep)}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {savedReports.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400 italic">No saved report configurations yet. Export a PDF/Excel or save a configuration above.</p>
          )}
        </div>
      </div>

      {/* Super Admin Historical Analytics Retention */}
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0"><ShieldAlert size={20} /></div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-[#102B4E]">Historical Analytics Data Retention</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Currently storing <strong>{totalAnalyticsCount.toLocaleString()}</strong> analytics event records. Permanent analytics deletion is strictly limited to Super Administrators.
              </p>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={analyticsPurgeDays}
                onChange={e => setAnalyticsPurgeDays(Number(e.target.value))}
                className="min-h-[42px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold flex-1 sm:flex-initial">
                <option value={30}>Older than 30 days</option>
                <option value={90}>Older than 90 days</option>
                <option value={180}>Older than 180 days</option>
                <option value={0}>All Historical Analytics</option>
              </select>
              <button
                onClick={() => setAnalyticsPurgeOpen(true)}
                className="min-h-[42px] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 w-full sm:w-auto">
                <Trash2 size={15} /> Purge Analytics Data
              </button>
            </div>
          ) : (
            <span className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold">Super Admin Authorization Required</span>
          )}
        </div>
      </div>

      {/* Top Performing Content */}
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-base sm:text-lg mb-5 sm:mb-8">Top Performing Content</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {topContent.map((item: any, idx) => (
            <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-50 hover:bg-slate-50 transition-all">
              <div className="w-8 h-8 rounded-lg bg-[#083D91] text-white flex items-center justify-center font-bold text-sm">
                {idx + 1}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#102B4E] text-sm truncate">{item.headline || item.title}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {item.views || 0} Views • {item.category}
                </p>
              </div>
            </div>
          ))}
          {topContent.length === 0 && !loading && (
            <div className="col-span-full py-12 text-center text-slate-400 italic">No activity recorded yet.</div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteReportTarget)}
        onClose={() => setDeleteReportTarget(null)}
        onConfirm={handleDeleteSavedReport}
        title="Delete Saved Report?" itemName={deleteReportTarget?.title}
        description="Permanently delete this saved report configuration / export record? Underlying analytics data remains intact." confirmLabel="Delete Report"isPermanent
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteReportsOpen}
        onClose={() => setBulkDeleteReportsOpen(false)}
        onConfirm={handleBulkDeleteReports}
        title={`Delete ${selectedReportIds.size} Saved Reports?`}
        description="Permanently delete the selected saved report entries." confirmLabel="Delete Reports"isPermanent
      />

      <DeleteConfirmModal
        isOpen={analyticsPurgeOpen}
        onClose={() => setAnalyticsPurgeOpen(false)}
        onConfirm={handlePurgeAnalytics}
        title="Purge Historical Analytics Data?" description={`Super Admin Retention Policy Action: This will permanently delete analytics events ${analyticsPurgeDays === 0 ? 'across ALL history': `older than ${analyticsPurgeDays} days`}. Please enter a retention policy justification.`}
        confirmLabel="Confirm Retention Purge"isPermanent
        requireTypeDelete
        reasonRequired
      />
    </div>
  );
}
