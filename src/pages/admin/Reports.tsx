import React from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { FileDown, Download, Printer, Filter, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';

export function ReportsPage() {
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

  const fetchData = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      let endDate: Date = new Date();

      if (dateRange === 'custom') {
        startDate = startOfDay(new Date(customStart));
        endDate = endOfDay(new Date(customEnd));
      } else {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        startDate = subDays(new Date(), days);
      }

      const [newsSnap, oppsSnap, analyticsSnap] = await Promise.all([
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'opportunities')),
        getDocs(query(
          collection(db, 'analytics'), 
          where('timestamp', '>=', startDate.toISOString()),
          where('timestamp', '<=', endDate.toISOString())
        ))
      ]);

      const newsDocs = newsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const oppsDocs = oppsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const analytics = analyticsSnap.docs.map(d => d.data());

      setSummary({
        news: newsDocs.length,
        jobs: oppsDocs.filter((o: any) => o.category === 'Jobs').length,
        scholarships: oppsDocs.filter((o: any) => o.category === 'Scholarships').length,
        tenders: oppsDocs.filter((o: any) => o.category === 'Tenders').length,
        views: analytics.length
      });

      // Top content
      const allContent = [...newsDocs, ...oppsDocs].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 5);
      setTopContent(allContent);

      // Daily distribution for chart
      const chartData: any[] = [];
      const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      for (let i = diffDays; i >= 0; i--) {
        const d = subDays(endDate, i);
        const dayLabel = format(d, 'MMM dd');
        const dayViews = analytics.filter(a => format(new Date(a.timestamp), 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd')).length;
        chartData.push({ name: dayLabel, views: dayViews });
      }
      setReportData(chartData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [dateRange, customStart, customEnd]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Traffic Report");
    XLSX.writeFile(wb, `Rwanda_Opportunities_Report_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF() as any;
    doc.text("Rwanda Opportunities - Performance Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 25);
    doc.text(`Period: Last ${dateRange}`, 14, 30);
    
    doc.autoTable({
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

    doc.save(`Rwanda_Report_${dateRange}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Generate professional insights and export data.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToPDF} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm">
            <FileDown size={18} /> PDF
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-600 rounded-xl font-bold text-white transition-all shadow-lg shadow-teal-500/20">
            <Download size={18} /> Export Excel
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6 overflow-x-auto w-full md:w-auto">
          {['7d', '30d', '90d', 'custom'].map((range) => (
            <button 
              key={range}
              onClick={() => setDateRange(range)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-lg text-sm font-bold transition-all",
                dateRange === range ? "bg-[#083D91] text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : range === '90d' ? 'Last 3 Months' : 'Custom Range'}
            </button>
          ))}
        </div>
        
        {dateRange === 'custom' && (
          <div className="flex items-center gap-3 w-full md:w-auto animate-in slide-in-from-right duration-300">
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span className="text-slate-400 text-xs">to</span>
              <input 
                type="date" 
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
            </div>
            <button onClick={fetchData} className="p-2.5 bg-[#083D91] text-white rounded-xl shadow-lg shadow-blue-900/20">
              <Filter size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-lg mb-8">Traffic Intensity</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
                <Tooltip cursor={{fill: '#F8FAFC'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="views" fill="#14B8A6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Summary Table */}
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-lg mb-8">Performance Summary</h3>
          <div className="space-y-6">
            {[
              { label: 'Published News', value: summary.news, color: 'bg-blue-50 text-blue-600' },
              { label: 'Active Jobs', value: summary.jobs, color: 'bg-teal-50 text-teal-600' },
              { label: 'Total Scholarships', value: summary.scholarships, color: 'bg-indigo-50 text-indigo-600' },
              { label: 'Active Tenders', value: summary.tenders, color: 'bg-amber-50 text-amber-600' },
              { label: 'Total Page Views', value: summary.views, color: 'bg-purple-50 text-purple-600' }
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center font-bold", item.color)}>
                    {item.label[0]}
                  </div>
                  <span className="text-sm font-medium text-slate-600">{item.label}</span>
                </div>
                <span className="text-lg font-extrabold text-[#102B4E]">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-4 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
            <Printer size={18} /> Print Full Report
          </button>
        </div>
      </div>

      {/* Top Performing Content */}
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-lg mb-8">Top Performing Content</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          {topContent.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 italic">No activity recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
