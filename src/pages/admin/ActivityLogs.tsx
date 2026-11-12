import React from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { History, Search, Filter, Shield, User, Clock, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ActivityLogs() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'), limit(100));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-emerald-600 bg-emerald-50';
      case 'delete': return 'text-red-600 bg-red-50';
      case 'edit': return 'text-amber-600 bg-amber-50';
      case 'login': return 'text-blue-600 bg-blue-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const filteredLogs = logs.filter(l => 
    l.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.module.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Activity Logs</h1>
        <p className="text-slate-500 mt-1">Audit trail of all administrative actions performed on the platform.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by admin name, module or action..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-6 hover:shadow-md transition-all">
            <div className={cn("p-3 rounded-xl flex-shrink-0", getActionColor(log.action))}>
              <Terminal size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-sm font-bold text-[#102B4E]">{log.adminName}</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded", getActionColor(log.action))}>
                  {log.action}
                </span>
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest ml-auto flex items-center gap-1">
                  <Clock size={12} /> {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                </span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-1">{log.details}</p>
              <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5"><Shield size={12} /> Module: {log.module}</span>
                {log.targetId && <span className="flex items-center gap-1.5"><User size={12} /> ID: {log.targetId}</span>}
              </div>
            </div>
          </div>
        ))}
        
        {filteredLogs.length === 0 && !loading && (
          <div className="bg-white p-20 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            No activity logs found.
          </div>
        )}
      </div>
    </div>
  );
}
