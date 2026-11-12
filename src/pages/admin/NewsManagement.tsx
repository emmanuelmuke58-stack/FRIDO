import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { NewsItem } from '../../types';
import { Plus, Trash, Edit, Search, Save, X, Eye, EyeOff, Layout, Type, Globe, User, Clock, ChevronLeft } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export function NewsManagement() {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list' | 'edit'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [currentArticle, setCurrentArticle] = React.useState<Partial<NewsItem>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'news'), orderBy('publishedAt', 'desc'));
      const snap = await getDocs(q);
      setNews(snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const generateSlug = (text: string) => {
    return text.toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  };

  const handleSave = async (status: 'published' | 'draft' = 'published') => {
    if (!currentArticle.headline) {
      alert('Headline is required');
      return;
    }

    try {
      const data = {
        ...currentArticle,
        slug: currentArticle.slug || generateSlug(currentArticle.headline),
        status,
        publishedAt: currentArticle.publishedAt || new Date().toISOString(),
        author: currentArticle.author || auth.currentUser?.displayName || 'Admin',
        views: currentArticle.views || 0,
        featured: currentArticle.featured || false,
        imageUrl: currentArticle.imageUrl || '/src/assets/images/rwanda_infrastructure_1794481092287.jpg'
      };

      if (currentArticle.id) {
        await updateDoc(doc(db, 'news', currentArticle.id), data);
        await logActivity('news', 'edit', `Edited news article: ${data.headline}`, currentArticle.id);
      } else {
        const docRef = await addDoc(collection(db, 'news'), data);
        await logActivity('news', 'create', `Created news article: ${data.headline}`, docRef.id);
      }
      setEditorMode('list');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to save article');
    }
  };

  if (editorMode === 'edit') {
    return (
      <div className="space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between border-b border-slate-200 pb-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setEditorMode('list')}
              className="p-2 hover:bg-slate-100 rounded-full transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-extrabold text-[#102B4E]">
              {currentArticle.id ? 'Edit Article' : 'Create New Article'}
            </h1>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => handleSave('draft')}
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Save Draft
            </button>
            <button 
              onClick={() => handleSave('published')}
              className="px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-teal-500/20 flex items-center gap-2"
            >
              <Save size={18} /> {currentArticle.id ? 'Update' : 'Publish'} Article
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Headline</label>
              <input 
                type="text" 
                className="w-full text-3xl font-bold border-none focus:ring-0 placeholder:text-slate-200 px-0 py-2"
                placeholder="Enter article headline..."
                value={currentArticle.headline || ''}
                onChange={e => {
                  const headline = e.target.value;
                  setCurrentArticle({ ...currentArticle, headline, slug: generateSlug(headline) });
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Article Body</label>
              <RichTextEditor 
                value={currentArticle.content || ''}
                onChange={content => setCurrentArticle({ ...currentArticle, content })}
                placeholder="Write your complete article here. Add unlimited paragraphs, headings, images..."
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Layout size={18} className="text-teal-500" /> Publishing Settings
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                    value={currentArticle.category || 'News'}
                    onChange={e => setCurrentArticle({ ...currentArticle, category: e.target.value as any })}
                  >
                    {['News', 'Economy', 'Infrastructure', 'Updates', 'Business', 'Technology', 'International'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Language</label>
                  <div className="flex gap-2">
                    {['Kinyarwanda', 'English'].map(l => (
                      <button
                        key={l}
                        onClick={() => setCurrentArticle({ ...currentArticle, language: l as any })}
                        className={cn(
                          "flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                          currentArticle.language === l ? "bg-[#083D91] text-white border-[#083D91]" : "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200"
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-mono"
                    value={currentArticle.slug || ''}
                    onChange={e => setCurrentArticle({ ...currentArticle, slug: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Publication Date</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="datetime-local" 
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                      value={currentArticle.publishedAt ? format(new Date(currentArticle.publishedAt), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={e => setCurrentArticle({ ...currentArticle, publishedAt: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 italic">Set a future date to schedule publication.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Globe size={18} className="text-teal-500" /> Metadata
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Short Summary</label>
                  <textarea 
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm h-32 resize-none"
                    placeholder="Brief excerpt for listings..."
                    value={currentArticle.summary || ''}
                    onChange={e => setCurrentArticle({ ...currentArticle, summary: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Featured Article</span>
                  <button 
                    onClick={() => setCurrentArticle({ ...currentArticle, featured: !currentArticle.featured })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      currentArticle.featured ? "bg-teal-500" : "bg-slate-200"
                    )}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentArticle.featured ? "left-7" : "left-1")} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">News Management</h1>
          <p className="text-slate-500 mt-1">Manage articles, drafts and track readership.</p>
        </div>
        <button 
          onClick={() => {
            setCurrentArticle({ status: 'draft', category: 'News', language: 'English', content: '' });
            setEditorMode('edit');
          }}
          className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus size={20} /> Create Article
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search articles..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {news.filter(n => n.headline.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
            <div className="flex items-center gap-6">
              <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden">
                <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
              </div>
              <div>
                <h3 className="font-bold text-[#102B4E] line-clamp-1">{item.headline}</h3>
                <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><User size={10} /> {item.author}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {format(new Date(item.publishedAt), 'MMM dd')}</span>
                  <span className={cn("px-2 py-0.5 rounded", item.status === 'published' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { setCurrentArticle(item); setEditorMode('edit'); }}
                className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={async () => {
                  if (window.confirm('Delete this article?')) {
                    await deleteDoc(doc(db, 'news', item.id));
                    await logActivity('news', 'delete', `Deleted news article: ${item.headline}`, item.id);
                    fetchData();
                  }
                }}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
