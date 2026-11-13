import React from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { WebPage } from '../../types';
import { Plus, Trash, Edit, FileText, Settings, Save } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { cn, generateSlug } from '../../lib/utils';

export function PageManagement() {
  const [pages, setPages] = React.useState<WebPage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list' | 'edit'>('list');
  const [currentPage, setCurrentPage] = React.useState<Partial<WebPage>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'pages'), orderBy('slug', 'asc'));
      const snap = await getDocs(q);
      setPages(snap.docs.map(d => ({ id: d.id, ...d.data() } as WebPage)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!currentPage.title?.trim() || !currentPage.slug?.trim()) {
      alert('Title and URL Slug are required');
      return;
    }
    try {
      const { id, ...rest } = currentPage;
      const data: Record<string, any> = {
        ...rest,
        title: currentPage.title.trim(),
        slug: generateSlug(currentPage.slug),
        content: rest.content || '<p></p>',
        lastUpdated: new Date().toISOString(),
        status: rest.status || 'published'
      };
      if (id) {
        await updateDoc(doc(db, 'pages', id), data);
        await logActivity('settings', 'edit', `Edited page: ${data.title}`, id);
      } else {
        const docRef = await addDoc(collection(db, 'pages'), data);
        await logActivity('settings', 'create', `Created page: ${data.title}`, docRef.id);
      }
      setEditorMode('list');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to save page');
    }
  };

  const handleDelete = async (page: WebPage) => {
    if (!window.confirm(`Delete page "${page.title}"?`)) return;
    try {
      await deleteDoc(doc(db, 'pages', page.id));
      await logActivity('settings', 'delete', `Deleted page: ${page.title}`, page.id);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (editorMode === 'edit') {
    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-[#102B4E]">{currentPage.id ? 'Edit Page' : 'New Page'}</h1>
          <div className="flex gap-3">
            <button onClick={() => setEditorMode('list')} className="px-6 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-500">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-teal-500 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2">
              <Save size={18} /> Save Page
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-2 bg-white p-6 rounded-2xl border border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page Title</label>
              <input
                className="w-full text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300"
                placeholder="Enter title..."
                value={currentPage.title || ''}
                onChange={e => {
                  const title = e.target.value;
                  setCurrentPage({
                    ...currentPage,
                    title,
                    slug: currentPage.id ? currentPage.slug : generateSlug(title)
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Page Content</label>
              <RichTextEditor value={currentPage.content || ''} onChange={c => setCurrentPage({ ...currentPage, content: c })} placeholder="Write your page content here..." />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold flex items-center gap-2 text-[#102B4E]"><Settings size={18} className="text-teal-500" /> Page Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={currentPage.slug || ''} onChange={e => setCurrentPage({ ...currentPage, slug: generateSlug(e.target.value) })} placeholder="about, privacy, terms, etc." />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEO Title</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={currentPage.seoTitle || ''} onChange={e => setCurrentPage({ ...currentPage, seoTitle: e.target.value })} placeholder="Custom title for search engines" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SEO Description</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm h-24 resize-none" value={currentPage.seoDescription || ''} onChange={e => setCurrentPage({ ...currentPage, seoDescription: e.target.value })} placeholder="Brief meta description..." />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Status</span>
                  <select
                    className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs font-bold"
                    value={currentPage.status || 'published'}
                    onChange={e => setCurrentPage({ ...currentPage, status: e.target.value as any })}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Website Pages</h1>
          <p className="text-slate-500 mt-1">Create and manage static informational pages (use slugs like about, privacy, terms).</p>
        </div>
        <button onClick={() => { setCurrentPage({ status: 'published', content: '' }); setEditorMode('edit'); }} className="bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all">
          <Plus size={20} /> Create New Page
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-400">Loading pages...</div>
        ) : pages.map(page => (
          <div key={page.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-110">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{page.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-slate-400 font-mono">/{page.slug === 'about' || page.slug === 'privacy' || page.slug === 'terms' ? page.slug : `p/${page.slug}`}</p>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest", page.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>{page.status}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setCurrentPage(page); setEditorMode('edit'); }} className="p-2 text-slate-400 hover:text-teal-600 transition-colors"><Edit size={18} /></button>
              <button onClick={() => handleDelete(page)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash size={18} /></button>
            </div>
          </div>
        ))}
        {!loading && pages.length === 0 && (
          <div className="bg-white p-16 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            No custom pages created yet. Create "about", "privacy", or "terms" to customize those pages!
          </div>
        )}
      </div>
    </div>
  );
}
