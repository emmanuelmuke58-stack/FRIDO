import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Subscriber } from '../../types';
import { Mail, Trash2, Download, CheckCircle2, XCircle, Search } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

export function NewsletterManagement() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'subscribers'), orderBy('subscribedAt', 'desc'));
      const snap = await getDocs(q);
      setSubscribers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subscriber)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const exportList = () => {
    const data = subscribers.map(s => ({ Email: s.email, Date: format(new Date(s.subscribedAt), 'PPP'), Status: s.status }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscribers");
    XLSX.writeFile(wb, "Newsletter_Subscribers.xlsx");
    logActivity('settings', 'export', 'Exported newsletter subscribers list');
  };

  const toggleStatus = async (sub: Subscriber) => {
    const newStatus = sub.status === 'active' ? 'unsubscribed' : 'active';
    try {
      await updateDoc(doc(db, 'subscribers', sub.id), { status: newStatus });
      fetchSubscribers();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const filteredSubscribers = subscribers.filter(s => s.email.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div className="p-20 text-center animate-pulse">Loading subscribers...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Newsletter Management</h1>
          <p className="text-slate-500 mt-1">Manage your mailing list and export subscriber data.</p>
        </div>
        <button 
          onClick={exportList}
          className="bg-[#083D91] hover:bg-[#07366D] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <Download size={20} /> Export List
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by email..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:border-teal-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subscribed On</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredSubscribers.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                   <p className="text-sm font-bold text-slate-900">{sub.email}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {format(new Date(sub.subscribedAt), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    sub.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
                  )}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => toggleStatus(sub)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        sub.status === 'active' ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"
                      )}
                      title={sub.status === 'active' ? 'Unsubscribe' : 'Activate'}
                    >
                      {sub.status === 'active' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
                    </button>
                    <button 
                      onClick={() => { if(window.confirm('Remove from list?')){ deleteDoc(doc(db, 'subscribers', sub.id)); fetchSubscribers(); } }}
                      className="p-2 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
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
    </div>
  );
}
