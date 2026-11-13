import React from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, where } from 'firebase/firestore';
import { Opportunity } from '../../types';
import {
  Plus, Trash, Edit, Search, Save, Globe, Clock, ChevronLeft,
  MapPin, Building2, Link as LinkIcon, DollarSign, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { logActivity } from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { cn, generateSlug } from '../../lib/utils';
import { format, isBefore } from 'date-fns';
import { useLocation } from 'react-router-dom';

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Jobs: ['Government', 'Private Sector', 'NGO', 'International', 'General'],
  Scholarships: ['Local', 'International', 'Undergraduate', "Master's", 'PhD'],
  Tenders: ['Government', 'Private Sector', 'NGO'],
  Others: ['Internships', 'Fellowships', 'Grants', 'Training', 'Conferences', 'Workshops']
};

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
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'draft' | 'expired'>('all');
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
    setEditorMode('list');
    fetchData();
  }, [pathCategory]);

  const handleSave = async (status: 'active' | 'draft' = 'active') => {
    if (!currentOpp.title?.trim() || !currentOpp.organization?.trim()) {
      alert('Title and Organization are required');
      return;
    }

    try {
      const { id, ...rest } = currentOpp;
      const deadline = rest.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const isExpired = isBefore(new Date(deadline), new Date());
      const finalStatus = status === 'active' && isExpired ? 'expired' : status;

      const data: Record<string, any> = {
        ...rest,
        title: currentOpp.title.trim(),
        organization: currentOpp.organization.trim(),
        category: rest.category || pathCategory,
        slug: generateSlug(rest.slug || currentOpp.title),
        status: finalStatus,
        description: rest.description || '<p></p>',
        location: rest.location || 'Kigali, Rwanda',
        type: rest.type || 'Full-time',
        applyUrl: rest.applyUrl || '',
        createdAt: rest.createdAt || new Date().toISOString(),
        deadline,
        views: Math.floor(Number(rest.views) || 0),
        clicks: Math.floor(Number(rest.clicks) || 0),
        featured: Boolean(rest.featured)
      };

      const logModule = (data.category === 'Others' ? 'news' : data.category.toLowerCase()) as any;

      if (id) {
        await updateDoc(doc(db, 'opportunities', id), data);
        await logActivity(logModule, 'edit', `Edited ${data.category}: ${data.title}`, id);
      } else {
        const docRef = await addDoc(collection(db, 'opportunities'), data);
        await logActivity(logModule, 'create', `Created ${data.category}: ${data.title}`, docRef.id);
      }
      setEditorMode('list');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to save opportunity');
    }
  };

  const toggleStatus = async (opp: Opportunity) => {
    const newStatus = opp.status === 'active' ? 'draft' : 'active';
    try {
      await updateDoc(doc(db, 'opportunities', opp.id), { status: newStatus });
      const logModule = (opp.category === 'Others' ? 'news' : opp.category.toLowerCase()) as any;
      await logActivity(logModule, 'edit', `Changed ${opp.title} status to ${newStatus}`, opp.id);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  };

  if (editorMode === 'edit') {
    const subOptions = SUBCATEGORY_OPTIONS[currentOpp.category || pathCategory] || SUBCATEGORY_OPTIONS.Others;

    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setEditorMode('list')} className="p-2 hover:bg-slate-100 rounded-full transition-all">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-extrabold text-[#102B4E]">
              {currentOpp.id ? `Edit ${pathCategory}` : `Create New ${pathCategory}`}
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
                  className="w-full text-2xl md:text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0"
                  placeholder="Enter opportunity title..."
                  value={currentOpp.title || ''}
                  onChange={e => {
                    const title = e.target.value;
                    setCurrentOpp({ ...currentOpp, title, slug: generateSlug(title) });
                  }}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</label>
                <RichTextEditor value={currentOpp.description || ''} onChange={val => setCurrentOpp({ ...currentOpp, description: val })} placeholder="Enter full description..." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsibilities / Scope</label>
                <RichTextEditor value={currentOpp.responsibilities || ''} onChange={val => setCurrentOpp({ ...currentOpp, responsibilities: val })} placeholder="Key responsibilities or scope..." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requirements & Eligibility</label>
                <RichTextEditor value={currentOpp.requirements || ''} onChange={val => setCurrentOpp({ ...currentOpp, requirements: val })} placeholder="What are the requirements?" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Benefits / Award Coverage</label>
                <RichTextEditor value={currentOpp.benefits || ''} onChange={val => setCurrentOpp({ ...currentOpp, benefits: val })} placeholder="Compensation, tuition coverage, or benefits..." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Application Instructions</label>
                <RichTextEditor value={currentOpp.applicationInstructions || ''} onChange={val => setCurrentOpp({ ...currentOpp, applicationInstructions: val })} placeholder="How to apply?" />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="font-bold flex items-center gap-2"><Globe size={18} className="text-teal-500" /> Basic Info</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                    value={currentOpp.category || pathCategory}
                    onChange={e => setCurrentOpp({ ...currentOpp, category: e.target.value as any })}
                  >
                    <option value="Jobs">Jobs</option>
                    <option value="Scholarships">Scholarships</option>
                    <option value="Tenders">Tenders</option>
                    <option value="Others">Others</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sub-Category</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                    value={currentOpp.subCategory || ''}
                    onChange={e => setCurrentOpp({ ...currentOpp, subCategory: e.target.value })}
                  >
                    <option value="">Select sub-category</option>
                    {subOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organization / Institution</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.organization || ''} onChange={e => setCurrentOpp({ ...currentOpp, organization: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentOpp.location || ''} onChange={e => setCurrentOpp({ ...currentOpp, location: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employment / Funding Type</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="e.g. Full-time, Fully Funded, Open Tender" value={currentOpp.type || ''} onChange={e => setCurrentOpp({ ...currentOpp, type: e.target.value })} />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salary / Award Value</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" placeholder="Competitive / Full Tuition" value={currentOpp.salary || ''} onChange={e => setCurrentOpp({ ...currentOpp, salary: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deadline</label>
                  <input
                    type="date"
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                    value={currentOpp.deadline ? format(new Date(currentOpp.deadline), 'yyyy-MM-dd') : ''}
                    onChange={e => {
                      if (e.target.value) {
                        setCurrentOpp({ ...currentOpp, deadline: new Date(e.target.value).toISOString() });
                      }
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono"
                    value={currentOpp.slug || ''}
                    onChange={e => setCurrentOpp({ ...currentOpp, slug: generateSlug(e.target.value) })}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-medium text-slate-700">Featured Listing</span>
                  <button
                    type="button"
                    onClick={() => setCurrentOpp({ ...currentOpp, featured: !currentOpp.featured })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      currentOpp.featured ? "bg-teal-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentOpp.featured ? "left-7" : "left-1")} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold flex items-center gap-2"><LinkIcon size={18} className="text-teal-500" /> External Link</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Apply URL</label>
                <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentOpp.applyUrl || ''} onChange={e => setCurrentOpp({ ...currentOpp, applyUrl: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredOpps = opps.filter(o => {
    const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) || o.organization.toLowerCase().includes(searchTerm.toLowerCase());
    const expired = isBefore(new Date(o.deadline), new Date());
    if (statusFilter === 'expired') return matchesSearch && (expired || o.status === 'expired');
    if (statusFilter === 'active') return matchesSearch && o.status === 'active' && !expired;
    if (statusFilter === 'draft') return matchesSearch && o.status === 'draft';
    return matchesSearch;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">{pathCategory} Management</h1>
          <p className="text-slate-500 mt-1">Post and manage {pathCategory.toLowerCase()}, deadlines, and applications.</p>
        </div>
        <button
          onClick={() => {
            setCurrentOpp({
              status: 'active',
              category: pathCategory,
              type: 'Full-time',
              location: 'Kigali, Rwanda',
              deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              description: '',
              requirements: '',
              applicationInstructions: ''
            });
            setEditorMode('edit');
          }}
          className="bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all"
        >
          <Plus size={20} /> Add {pathCategory === 'Others' ? 'Opportunity' : pathCategory.slice(0, -1)}
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder={`Search ${pathCategory.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'draft', 'expired'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                statusFilter === s ? "bg-[#083D91] text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading {pathCategory.toLowerCase()}...</div>
        ) : filteredOpps.map((opp) => {
          const expired = isBefore(new Date(opp.deadline), new Date());
          return (
            <div key={opp.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden group">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="px-3 py-1 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    {opp.subCategory || opp.category}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => toggleStatus(opp)} className="p-2 text-slate-400 hover:text-[#083D91]" title={opp.status === 'active' ? 'Unpublish' : 'Publish'}>
                      {opp.status === 'active' ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button onClick={() => { setCurrentOpp(opp); setEditorMode('edit'); }} className="p-2 text-slate-400 hover:text-teal-600" title="Edit"><Edit size={16} /></button>
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete this opportunity?')) {
                          await deleteDoc(doc(db, 'opportunities', opp.id));
                          const logModule = (opp.category === 'Others' ? 'news' : opp.category.toLowerCase()) as any;
                          await logActivity(logModule, 'delete', `Deleted ${opp.category}: ${opp.title}`, opp.id);
                          fetchData();
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash size={16} />
                    </button>
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
                  <span>{opp.views || 0} Views • {opp.clicks || 0} Clicks</span>
                  <div className="flex items-center gap-2">
                    {expired && (
                      <span className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded">
                        <AlertCircle size={10} /> Expired
                      </span>
                    )}
                    <span className={cn("px-2 py-0.5 rounded", opp.status === 'active' ? "text-emerald-500 bg-emerald-50" : "bg-slate-100")}>{opp.status}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!loading && filteredOpps.length === 0 && (
          <div className="col-span-full bg-white p-16 rounded-3xl border border-slate-100 text-center text-slate-400 italic">
            No {pathCategory.toLowerCase()} listings found. Click "Add" to create one.
          </div>
        )}
      </div>
    </div>
  );
}
