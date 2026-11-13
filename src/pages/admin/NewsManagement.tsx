import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { NewsItem } from '../../types';
import { Plus, Trash, Edit, Search, Save, Eye, EyeOff, Layout, Globe, User, Clock, ChevronLeft, Image as ImageIcon, Tag } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { cn, generateSlug } from '../../lib/utils';
import { format, isAfter } from 'date-fns';

export function NewsManagement() {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list' | 'edit'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'published' | 'draft' | 'scheduled'>('all');
  const [currentArticle, setCurrentArticle] = React.useState<Partial<NewsItem>>({});
  const [isMediaOpen, setMediaOpen] = React.useState(false);

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

  const handleSave = async (requestedStatus: 'published' | 'draft' = 'published') => {
    if (!currentArticle.headline?.trim()) {
      alert('Headline is required');
      return;
    }

    try {
      const { id, ...rest } = currentArticle;
      const publishedAt = rest.publishedAt || new Date().toISOString();
      const isFuture = isAfter(new Date(publishedAt), new Date());
      const finalStatus = requestedStatus === 'published' && isFuture ? 'scheduled' : requestedStatus;

      const data: Record<string, any> = {
        ...rest,
        headline: currentArticle.headline.trim(),
        slug: generateSlug(rest.slug || currentArticle.headline),
        content: rest.content || '<p></p>',
        summary: rest.summary || '',
        status: finalStatus,
        category: rest.category || 'News',
        language: rest.language || 'English',
        publishedAt,
        author: rest.author || auth.currentUser?.displayName || auth.currentUser?.email || 'Admin',
        views: Math.floor(Number(rest.views) || 0),
        featured: Boolean(rest.featured),
        imageUrl: rest.imageUrl || '/src/assets/images/rwanda_infrastructure_1794481092287.jpg'
      };

      if (id) {
        await updateDoc(doc(db, 'news', id), data);
        await logActivity('news', finalStatus === 'published' ? 'publish' : 'edit', `Updated news article: ${data.headline}`, id);
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

  const togglePublish = async (item: NewsItem) => {
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await updateDoc(doc(db, 'news', item.id), { status: newStatus });
      await logActivity('news', newStatus === 'published' ? 'publish' : 'edit', `Set article "${item.headline}" to ${newStatus}`, item.id);
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Failed to update article status');
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
              <Save size={18} />
              {currentArticle.publishedAt && isAfter(new Date(currentArticle.publishedAt), new Date())
                ? 'Schedule Publication'
                : currentArticle.id ? 'Update & Publish' : 'Publish Article'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Headline</label>
              <input
                type="text"
                className="w-full text-2xl md:text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0 py-1"
                placeholder="Enter article headline..."
                value={currentArticle.headline || ''}
                onChange={e => {
                  const headline = e.target.value;
                  setCurrentArticle({ ...currentArticle, headline, slug: generateSlug(headline) });
                }}
              />
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-3">Subtitle / Lead Paragraph</label>
              <input
                type="text"
                className="w-full text-base text-slate-600 border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0 py-1"
                placeholder="Optional article subtitle..."
                value={currentArticle.subtitle || ''}
                onChange={e => setCurrentArticle({ ...currentArticle, subtitle: e.target.value })}
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
                        type="button"
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
                    onChange={e => setCurrentArticle({ ...currentArticle, slug: generateSlug(e.target.value) })}
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
                      onChange={e => {
                        if (e.target.value) {
                          setCurrentArticle({ ...currentArticle, publishedAt: new Date(e.target.value).toISOString() });
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 italic">Set a future date to schedule publication.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon size={18} className="text-teal-500" /> Featured Image
              </h3>
              {currentArticle.imageUrl && (
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                  <img src={currentArticle.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="https://... or /src/assets/..."
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs font-mono"
                  value={currentArticle.imageUrl || ''}
                  onChange={e => setCurrentArticle({ ...currentArticle, imageUrl: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <ImageIcon size={14} /> Choose from Media Library
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Caption</label>
                <input
                  type="text"
                  placeholder="Photo caption..."
                  className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                  value={currentArticle.imageCaption || ''}
                  onChange={e => setCurrentArticle({ ...currentArticle, imageCaption: e.target.value })}
                />
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
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm h-28 resize-none"
                    placeholder="Brief excerpt for listings..."
                    value={currentArticle.summary || ''}
                    onChange={e => setCurrentArticle({ ...currentArticle, summary: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags (comma-separated)</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="economy, kigali, jobs"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                      value={(currentArticle.tags || []).join(', ')}
                      onChange={e => setCurrentArticle({
                        ...currentArticle,
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10)
                      })}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Featured Article</span>
                  <button
                    type="button"
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

        <MediaPickerModal
          isOpen={isMediaOpen}
          onClose={() => setMediaOpen(false)}
          onSelect={(url) => setCurrentArticle({ ...currentArticle, imageUrl: url })}
        />
      </div>
    );
  }

  const filteredNews = news.filter(n => {
    const matchesSearch = n.headline.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">News Management</h1>
          <p className="text-slate-500 mt-1">Manage articles, drafts, scheduled posts and track readership.</p>
        </div>
        <button
          onClick={() => {
            setCurrentArticle({ status: 'draft', category: 'News', language: 'English', content: '', publishedAt: new Date().toISOString() });
            setEditorMode('edit');
          }}
          className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
        >
          <Plus size={20} /> Create Article
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search articles..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft', 'scheduled'] as const).map(s => (
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

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-400">Loading articles...</div>
        ) : filteredNews.map(item => (
          <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-all group">
            <div className="flex items-center gap-6 min-w-0">
              <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                <img src={item.imageUrl} className="w-full h-full object-cover" alt="" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[#102B4E] line-clamp-1">{item.headline}</h3>
                <div className="flex flex-wrap items-center gap-4 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><User size={10} /> {item.author}</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {format(new Date(item.publishedAt), 'MMM dd, yyyy')}</span>
                  <span>{item.views || 0} Views</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded",
                    item.status === 'published' ? "bg-emerald-50 text-emerald-600" :
                    item.status === 'scheduled' ? "bg-blue-50 text-blue-600" :
                    "bg-amber-50 text-amber-600"
                  )}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => togglePublish(item)}
                className="p-2 text-slate-400 hover:text-[#083D91] transition-colors"
                title={item.status === 'published' ? 'Unpublish' : 'Publish'}
              >
                {item.status === 'published' ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                onClick={() => { setCurrentArticle(item); setEditorMode('edit'); }}
                className="p-2 text-slate-400 hover:text-teal-600 transition-colors"
                title="Edit"
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
                title="Delete"
              >
                <Trash size={18} />
              </button>
            </div>
          </div>
        ))}
        {!loading && filteredNews.length === 0 && (
          <div className="bg-white p-16 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            No articles match your filter.
          </div>
        )}
      </div>
    </div>
  );
}
