import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Opportunity } from '../../types';
import { Plus, Trash, Edit, Search, Save, X, Eye, EyeOff, Layout, Type, Globe, User, Clock, ChevronLeft, MapPin, Building2, Link as LinkIcon, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { cn } from '../../lib/utils';
import { format, isAfter, isBefore } from 'date-fns';

import { useLocation } from 'react-router-dom';

export function OpportunityManagement() {
  const location = useLocation();
  const pathCategory = React.useMemo(() => {
    const path = location.pathname.split('/').pop();
    if (path === 'jobs') return 'Jobs';
    if (path === 'scholarships') return 'Scholarships';
    if (path === 'tenders') return 'Tenders';
    return 'Others';
  }, [location.pathname]);

  const [opps, setOpps] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list' | 'edit'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [currentOpp, setCurrentOpp] = React.useState<Partial<Opportunity>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'opportunities'), 
        where('category', '==', pathCategory), 
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setOpps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Opportunity)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [pathCategory]);

  const generateSlug = (text: string) => {
    return text.toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  };

  const handleSave = async (status: 'active' | 'draft' = 'active') => {
    if (!currentOpp.title || !currentOpp.organization) {
      alert('Title and Organization are required');
      return;
    }

    try {
      const data = {
        ...currentOpp,
        category: pathCategory,
        slug: currentOpp.slug || generateSlug(currentOpp.title),
        status,
        createdAt: currentOpp.createdAt || new Date().toISOString(),
        deadline: currentOpp.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        views: currentOpp.views || 0,
        clicks: currentOpp.clicks || 0,
        featured: currentOpp.featured || false
      };

      const logModule = pathCategory.toLowerCase() as any;

      if (currentOpp.id) {
        await updateDoc(doc(db, 'opportunities', currentOpp.id), data);
        await logActivity(logModule, 'edit', `Edited ${pathCategory.slice(0, -1)}: ${data.title}`, currentOpp.id);
      } else {
        const docRef = await addDoc(collection(db, 'opportunities'), data);
        await logActivity(logModule, 'create', `Created ${pathCategory.slice(0, -1)}: ${data.title}`, docRef.id);
      }
      setEditorMode('list');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to save opportunity');
    }
  };

  if (editorMode === 'edit') {
    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditorMode('list')} className="p-2 hover:bg-slate-100 rounded-full transition-all">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-extrabold text-[#102B4E]">
              {currentOpp.id ? 'Edit Opportunity' : 'Create New Opportunity'}
            </h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => handleSave('draft')} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Save Draft
            </button>
            <button onClick={() => handleSave('active')} className="px-6 py-2.5 bg-[#083D91] hover:bg-[#07366D] text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2">
              <Save size={18} /> {currentOpp.id ? 'Update' : 'Publish'} Opportunity
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Title</label>
                <input 
                  type="text" 
                  className="w-full text-3xl font-bold border-none focus:ring-0 placeholder:text-slate-200 px-0"
                  placeholder="Enter opportunity title..."
                  value={currentOpp.title || ''}
                  onChange={e => {
                    const title = e.target.value;
                    setCurrentOpp({ ...currentOpp, title, slug: generateSlug(title) });
                  }}
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                <RichTextEditor value={currentOpp.description || ''} onChange={val => setCurrentOpp({...currentOpp, description: val})} placeholder="Enter full description..." />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirements & Eligibility</label>
                <RichTextEditor value={currentOpp.requirements || ''} onChange={val => setCurrentOpp({...currentOpp, requirements: val})} placeholder="What are the requirements?" />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application Instructions</label>
                <RichTextEditor value={currentOpp.applicationInstructions || ''} onChange={val => setCurrentOpp({...currentOpp, applicationInstructions: val})} placeholder="How to apply?" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="font-bold flex items-center gap-2"><Globe size={18} className="text-teal-500" /> Basic Info</h3>
                <div className="space-y-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                      <select 
                        className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                        value={currentOpp.category || 'Jobs'}
                        onChange={e => setCurrentOpp({...currentOpp, category: e.target.value as any})}
                      >
                        <option>Jobs</option>
                        <option>Scholarships</option>
                        <option>Tenders</option>
                        <option>Others</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.organization || ''} onChange={e => setCurrentOpp({...currentOpp, organization: e.target.value})} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.location || ''} onChange={e => setCurrentOpp({...currentOpp, location: e.target.value})} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</label>
                      <input type="date" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.deadline ? format(new Date(currentOpp.deadline), 'yyyy-MM-dd') : ''} onChange={e => setCurrentOpp({...currentOpp, deadline: new Date(e.target.value).toISOString()})} />
                   </div>
                </div>
             </div>

             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <h3 className="font-bold flex items-center gap-2"><LinkIcon size={18} className="text-teal-500" /> External Link</h3>
                <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Apply URL</label>
                   <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentOpp.applyUrl || ''} onChange={e => setCurrentOpp({...currentOpp, applyUrl: e.target.value})} placeholder="https://..." />
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Opportunity Management</h1>
          <p className="text-slate-500 mt-1">Post and manage jobs, scholarships and tenders.</p>
        </div>
        <button 
          onClick={() => {
            setCurrentOpp({ status: 'active', category: 'Jobs', type: 'Full-time', description: '', requirements: '', applicationInstructions: '' });
            setEditorMode('edit');
          }}
          className="bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
        >
          <Plus size={20} /> Add Opportunity
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search opportunities..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {opps.filter(o => o.title.toLowerCase().includes(searchTerm.toLowerCase())).map((opp) => (
          <div key={opp.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  {opp.category}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setCurrentOpp(opp); setEditorMode('edit'); }} className="p-2 text-slate-400 hover:text-teal-600"><Edit size={16} /></button>
                  <button onClick={() => { if(window.confirm('Delete?')){ deleteDoc(doc(db, 'opportunities', opp.id)); fetchData(); } }} className="p-2 text-slate-400 hover:text-red-500"><Trash size={16} /></button>
                </div>
              </div>
              <h3 className="font-bold text-[#102B4E] text-lg mb-4 line-clamp-2 min-h-[3.5rem]">{opp.title}</h3>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Building2 size={14} className="text-slate-400" /> {opp.organization}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                  <Clock size={14} className="text-amber-500" /> {format(new Date(opp.deadline), 'MMM dd, yyyy')}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                <span>{opp.views || 0} Views</span>
                <div className="flex items-center gap-2">
                  {isBefore(new Date(opp.deadline), new Date()) && (
                    <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded">
                      <AlertCircle size={10} /> Expired
                    </span>
                  )}
                  <span className={cn("px-2 py-0.5 rounded", opp.status === 'active' ? "text-emerald-500 bg-emerald-50" : "bg-slate-100")}>{opp.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
