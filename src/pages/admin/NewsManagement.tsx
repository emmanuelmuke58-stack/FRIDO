import React from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { NewsItem } from '../../types';
import {
  Plus, Trash2, Edit, Search, Save, Eye, EyeOff, Layout, Globe, User,
  Clock, ChevronLeft, Image as ImageIcon, Tag, RotateCcw
} from 'lucide-react';
import {
  logActivity,
  softDeleteRecord,
  bulkSoftDeleteRecords,
  permanentDeleteRecord,
  bulkPermanentDeleteRecords,
  restoreRecord,
} from '../../lib/services';
import { RichTextEditor } from '../../components/admin/RichTextEditor';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { canSoftDeleteContent, canPermanentDelete, canRestoreContent } from '../../lib/permissions';
import { useAdminAuth } from './AdminLayout';
import { cn, generateSlug, safeDate, safeFormatDate, extractErrorMessage, stripUndefined } from '../../lib/utils';
import { invalidatePublicCache } from '../../lib/publicData';
import { isAfter } from 'date-fns';
import { NavLink } from 'react-router-dom';

const DEFAULT_NEWS_CATEGORIES = ['News', 'Economy', 'Infrastructure', 'Updates', 'Business', 'Technology', 'International'];
const PAGE_SIZE = 15;

export function NewsManagement() {
  const { userProfile } = useAdminAuth();
  const [allNews, setAllNews] = React.useState<NewsItem[]>([]);
  const [categories, setCategories] = React.useState<string[]>(DEFAULT_NEWS_CATEGORIES);
  const [loading, setLoading] = React.useState(true);
  const [editorMode, setEditorMode] = React.useState<'list'| 'edit'>('list');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all'| 'published'| 'draft'| 'scheduled'| 'deleted'>('all');
  const [currentArticle, setCurrentArticle] = React.useState<Partial<NewsItem>>({});

  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = React.useState<NewsItem | null>(null);
  const [permDeleteTarget, setPermDeleteTarget] = React.useState<NewsItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [feedback, setFeedback] = React.useState<FeedbackState | null>(null);

  const allowPermanent = canPermanentDelete(userProfile);
  const allowRestore = canRestoreContent(userProfile);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [newsSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, 'news'), orderBy('publishedAt', 'desc'))),
        getDocs(query(collection(db, 'categories'), where('module', '==', 'News'))),
      ]);
      setAllNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
      const customCats = catSnap.docs
        .map(d => d.data())
        .filter(c => c.status !== 'deleted')
        .map(c => c.name as string);
      setCategories(Array.from(new Set([...DEFAULT_NEWS_CATEGORIES, ...customCats])));
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load articles.'});
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const activeNews = React.useMemo(() => allNews.filter(n => n.status !== 'deleted'), [allNews]);
  const deletedNews = React.useMemo(() => allNews.filter(n => n.status === 'deleted'), [allNews]);

  const handleSave = async (requestedStatus: 'published'| 'draft'= 'published') => {
    if (!currentArticle.headline?.trim()) {
      setFeedback({ type: 'error', message: 'Headline is required.'});
      return;
    }

    try {
      const { id, ...rest } = currentArticle;
      const publishedAt = rest.publishedAt || new Date().toISOString();
      const parsedPub = safeDate(publishedAt);
      const isFuture = parsedPub ? isAfter(parsedPub, new Date()) : false;
      const finalStatus = requestedStatus === 'published'&& isFuture ? 'scheduled': requestedStatus;
      const resolvedAuthorId = rest.authorId || auth.currentUser?.uid || null;

      const resolvedAuthorAvatar =
        resolvedAuthorId === auth.currentUser?.uid
          ? userProfile?.avatarUrl || auth.currentUser?.photoURL || rest.authorAvatar || ''
          : rest.authorAvatar || '';

      const data = stripUndefined({
        ...rest,
        headline: currentArticle.headline.trim().slice(0, 200),
        slug: generateSlug(rest.slug || currentArticle.headline).slice(0, 200),
        content: rest.content || '<p></p>',
        summary: (rest.summary || '').slice(0, 1000),
        status: finalStatus,
        category: (rest.category || 'News').slice(0, 100),
        language: rest.language || 'English',
        publishedAt,
        author: (rest.author || userProfile?.displayName || auth.currentUser?.displayName || auth.currentUser?.email || 'Admin').slice(0, 120),
        authorId: resolvedAuthorId,
        authorAvatar: resolvedAuthorAvatar ? resolvedAuthorAvatar.slice(0, 2000) : undefined,
        views: Math.max(0, Math.floor(Number(rest.views) || 0)),
        featured: Boolean(rest.featured),
        imageUrl: (rest.imageUrl ?? '').slice(0, 2000),
      });

      if (id) {
        await updateDoc(doc(db, 'news', id), data);
        await logActivity('news', finalStatus === 'published'? 'publish': 'edit', `Updated news article: ${data.headline}`, id);
      } else {
        const docRef = await addDoc(collection(db, 'news'), data);
        await logActivity('news', 'create', `Created news article: ${data.headline}`, docRef.id);
      }
      invalidatePublicCache();
      setEditorMode('list');
      setFeedback({ type: 'success', message: `Article "${data.headline}" saved.` });
      fetchData();
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to save article.') });
    }
  };

  const togglePublish = async (item: NewsItem) => {
    const newStatus = item.status === 'published'? 'draft': 'published';
    try {
      await updateDoc(doc(db, 'news', item.id), { status: newStatus });
      invalidatePublicCache();
      await logActivity('news', newStatus === 'published'? 'publish': 'edit', `Set article "${item.headline}" to ${newStatus}`, item.id);
      setFeedback({ type: 'success', message: `Article "${item.headline}" is now ${newStatus}.` });
      fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to update article status.') });
    }
  };

  const handleConfirmSingleDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    if (!deleteTarget) return;
    try {
      if (isPermanentDelete) {
        await permanentDeleteRecord('news', deleteTarget.id, deleteTarget.headline, 'news', reason);
        setFeedback({
          type: 'success',
          message: `Article "${deleteTarget.headline}" was permanently deleted.`,
        });
      } else {
        await softDeleteRecord('news', deleteTarget.id, deleteTarget.status, deleteTarget.headline, 'news', reason);
        setFeedback({
          type: 'success',
          message: `Article "${deleteTarget.headline}" was moved to Trash and removed from the public website.`,
          actionLabel: 'View Deleted Articles',
          onAction: () => {
            setStatusFilter('deleted');
            setSelectedIds(new Set());
          },
        });
      }
      const deletedId = deleteTarget.id;
      setDeleteTarget(null);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Permission denied deleting this article.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleRestore = async (item: NewsItem) => {
    try {
      await restoreRecord('news', item.id, 'draft', item.previousStatus, item.headline, 'news');
      setFeedback({
        type: 'success',
        message: `Restored "${item.headline}" back to active articles.`,
      });
      await fetchData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to restore article.') });
    }
  };

  const handleConfirmPermanentFromDeleted = async (reason?: string) => {
    if (!permDeleteTarget) return;
    try {
      await permanentDeleteRecord('news', permDeleteTarget.id, permDeleteTarget.headline, 'news', reason);
      setFeedback({ type: 'success', message: `Permanently deleted "${permDeleteTarget.headline}".` });
      setPermDeleteTarget(null);
      await fetchData();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to permanently delete article.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const sourceList = statusFilter === 'deleted'? deletedNews : activeNews;
  const filteredNews = sourceList.filter(n => {
    const matchesSearch =
      n.headline.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.deletedByName || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'deleted') return matchesSearch;
    const matchesStatus = statusFilter === 'all'|| n.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedNews = filteredNews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleConfirmBulkDelete = async (reason?: string, isPermanentDelete?: boolean) => {
    const selectedItems = filteredNews.filter(n => selectedIds.has(n.id));
    if (selectedItems.length === 0) return;

    if (statusFilter === 'deleted'|| isPermanentDelete) {
      if (!allowPermanent) {
        const msg = 'Only Super Administrators can permanently delete articles.';
        setFeedback({ type: 'error', message: msg });
        throw new Error(msg);
      }
      const res = await bulkPermanentDeleteRecords(
        'news',
        selectedItems.map(a => ({ id: a.id, title: a.headline })),
        'news',
        reason
      );
      setFeedback({
        type: res.failed > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
        message: `Permanently deleted ${res.succeeded} article(s).${res.failed > 0 ? ` ${res.failed} failed.` : ''}`,
        details: res.errors,
      });
      if (res.succeeded === 0 && res.failed > 0) {
        throw new Error(res.errors[0] || 'Failed to delete selected articles.');
      }
      setSelectedIds(new Set());
      await fetchData();
      return;
    }

    const authorized = selectedItems.filter(n => canSoftDeleteContent(userProfile, 'News', n.authorId));
    const unauthorizedCount = selectedItems.length - authorized.length;

    if (authorized.length === 0) {
      const msg = 'You do not have permission to delete any of the selected articles.';
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }

    const res = await bulkSoftDeleteRecords(
      'news',
      authorized.map(a => ({ id: a.id, status: a.status, title: a.headline })),
      'news',
      reason
    );

    const details = [...res.errors];
    if (unauthorizedCount > 0) {
      details.push(`${unauthorizedCount} article(s) skipped due to editor ownership restrictions.`);
    }

    setFeedback({
      type: res.failed > 0 || unauthorizedCount > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Moved ${res.succeeded} article(s) to Trash.${res.failed + unauthorizedCount > 0 ? ` ${res.failed + unauthorizedCount} skipped/failed.` : ''}`,
      details,
      actionLabel: res.succeeded > 0 ? 'View Deleted Articles': undefined,
      onAction: res.succeeded > 0 ? () => {
        setStatusFilter('deleted');
        setSelectedIds(new Set());
      } : undefined,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to move articles to Trash.');
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  if (editorMode === 'edit') {
    return (
      <div className="space-y-6 sm:space-y-8 animate-in slide-in-from-right duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 sm:pb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditorMode('list')} className="min-w-[40px] min-h-[40px] p-2 hover:bg-slate-100 rounded-full transition-all flex-shrink-0">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-[#102B4E] truncate">
              {currentArticle.id ? 'Edit Article': 'Create New Article'}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleSave('draft')}
              className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Save Draft
            </button>
            <button
              onClick={() => handleSave('published')}
              className="flex-1 sm:flex-none min-h-[44px] px-4 sm:px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2">
              <Save size={18} />
              {currentArticle.publishedAt && safeDate(currentArticle.publishedAt) && isAfter(safeDate(currentArticle.publishedAt)!, new Date())
                ? 'Schedule Publication': currentArticle.id ? 'Update & Publish': 'Publish Article'}
            </button>
          </div>
        </div>

        <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <div className="lg:col-span-2 min-w-0 space-y-6">
            <div className="space-y-2 bg-white p-4 sm:p-6 rounded-2xl border border-slate-100 shadow-sm">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Headline</label>
              <input
                type="text" className="w-full text-xl sm:text-2xl md:text-3xl font-bold border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0 py-1" placeholder="Enter article headline..." value={currentArticle.headline || ''}
                onChange={e => {
                  const headline = e.target.value;
                  setCurrentArticle({ ...currentArticle, headline, slug: generateSlug(headline) });
                }}
              />
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block pt-3">Subtitle / Lead Paragraph</label>
              <input
                type="text" className="w-full text-sm sm:text-base text-slate-600 border-none focus:outline-none focus:ring-0 placeholder:text-slate-300 px-0 py-1" placeholder="Optional article subtitle..." value={currentArticle.subtitle || ''}
                onChange={e => setCurrentArticle({ ...currentArticle, subtitle: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Article Body</label>
                {currentArticle.content && (
                  <button
                    type="button" onClick={() => setCurrentArticle({ ...currentArticle, content: ''})}
                    className="text-xs font-bold text-red-500 hover:underline flex items-center gap-1">
                    <Trash2 size={12} /> Clear Body Content
                  </button>
                )}
              </div>
              <RichTextEditor
                value={currentArticle.content || ''}
                onChange={content => setCurrentArticle({ ...currentArticle, content })}
                placeholder="Write your complete article here. Add unlimited paragraphs, headings, images..."/>
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Layout size={18} className="text-teal-500"/> Publishing Settings
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</label>
                  <select
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm" value={currentArticle.category || 'News'}
                    onChange={e => setCurrentArticle({ ...currentArticle, category: e.target.value })}
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Language</label>
                  <div className="flex gap-2">
                    {['Kinyarwanda', 'English'].map(l => (
                      <button
                        type="button" key={l}
                        onClick={() => setCurrentArticle({ ...currentArticle, language: l as any })}
                        className={cn(
                          "flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                          currentArticle.language === l ? "bg-[#083D91] text-white border-[#083D91]": "bg-slate-50 text-slate-500 border-transparent hover:border-slate-200")}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">URL Slug</label>
                  <input
                    type="text" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm font-mono" value={currentArticle.slug || ''}
                    onChange={e => setCurrentArticle({ ...currentArticle, slug: generateSlug(e.target.value) })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Publication Date</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="datetime-local" className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-lg text-sm" value={safeFormatDate(currentArticle.publishedAt, "yyyy-MM-dd'T'HH:mm", '')}
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
                <ImageIcon size={18} className="text-teal-500"/> Featured Image
              </h3>
              <ImageUploadField
                value={currentArticle.imageUrl || ''}
                aspectHint="16:9"
                onChange={(url) =>
                  setCurrentArticle({
                    ...currentArticle,
                    imageUrl: url,
                    imageCaption: url ? currentArticle.imageCaption : '',
                  })
                }
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Caption</label>
                <input
                  type="text" placeholder="Photo caption..." className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm" value={currentArticle.imageCaption || ''}
                  onChange={e => setCurrentArticle({ ...currentArticle, imageCaption: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Globe size={18} className="text-teal-500"/> Metadata
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Short Summary</label>
                  <textarea
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-lg text-sm h-28 resize-none" placeholder="Brief excerpt for listings..." value={currentArticle.summary || ''}
                    onChange={e => setCurrentArticle({ ...currentArticle, summary: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags (comma-separated)</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text" placeholder="economy, kigali, jobs" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm" value={(currentArticle.tags || []).join(', ')}
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
                    type="button" onClick={() => setCurrentArticle({ ...currentArticle, featured: !currentArticle.featured })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      currentArticle.featured ? "bg-teal-500": "bg-slate-200")}
                  >
                    <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", currentArticle.featured ? "left-7": "left-1")} />
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">News Management</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage articles, drafts, scheduled posts, and inspect or restore deleted articles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavLink
            to="/admin/trash" className="min-h-[44px] px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
            <Trash2 size={16} /> Trash
            {deletedNews.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700">
                {deletedNews.length}
              </span>
            )}
          </NavLink>
          <button
            onClick={() => {
              setCurrentArticle({ status: 'draft', category: 'News', language: 'English', content: '', publishedAt: new Date().toISOString() });
              setEditorMode('edit');
            }}
            className="flex-1 sm:flex-none min-h-[44px] bg-teal-500 hover:bg-teal-600 text-white px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all">
            <Plus size={20} /> Create Article
          </button>
        </div>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text" placeholder="Search articles..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none" value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(['all', 'published', 'draft', 'scheduled', 'deleted'] as const).map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setCurrentPage(1); setSelectedIds(new Set()); }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all inline-flex items-center gap-1.5",
                statusFilter === s
                  ? (s === 'deleted'? "bg-red-600 text-white": "bg-[#083D91] text-white")
                  : (s === 'deleted'? "bg-red-50 text-red-600 hover:bg-red-100": "bg-slate-50 text-slate-500 hover:bg-slate-100")
              )}
            >
              {s === 'deleted'? `Deleted (${deletedNews.length})` : s}
            </button>
          ))}
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={paginatedNews.length}
        totalFilteredCount={filteredNews.length}
        allFilteredSelected={selectedIds.size === filteredNews.length && filteredNews.length > 0}
        onSelectPage={(checked) => {
          const next = new Set(selectedIds);
          paginatedNews.forEach(item => checked ? next.add(item.id) : next.delete(item.id));
          setSelectedIds(next);
        }}
        onSelectAllFiltered={() => setSelectedIds(new Set(filteredNews.map(n => n.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
        bulkDeleteLabel={statusFilter === 'deleted'? 'Permanently Delete': 'Delete Selected'}
        canDelete={statusFilter === 'deleted'? allowPermanent : true}
      />

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center text-slate-400">Loading articles...</div>
        ) : paginatedNews.map(item => {
          const isDeleted = item.status === 'deleted';
          const allowDelete = canSoftDeleteContent(userProfile, 'News', item.authorId);
          return (
            <div key={item.id} className={cn(
              "bg-white p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-all group",
              isDeleted ? "border-red-100 bg-red-50/20": "border-slate-100")}>
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <input
                  type="checkbox" checked={selectedIds.has(item.id)}
                  onChange={() => {
                    const next = new Set(selectedIds);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    setSelectedIds(next);
                  }}
                  className="w-4 h-4 mt-1 sm:mt-0 rounded border-slate-300 text-[#083D91] flex-shrink-0"/>
                <div className="w-16 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                  {item.imageUrl && <img src={item.imageUrl} className="w-full h-full object-cover" alt=""/>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[#102B4E] line-clamp-2 sm:line-clamp-1">{item.headline}</h3>
                  {isDeleted ? (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      Deleted {safeFormatDate(item.deletedAt, 'MMM dd, yyyy HH:mm')}
                      {item.deletedByName ? ` by ${item.deletedByName}` : ''}
                      {item.deleteReason ? ` • Reason: ${item.deleteReason}` : ''}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><User size={10} /> {item.author}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {safeFormatDate(item.publishedAt, 'MMM dd, yyyy')}</span>
                      <span>{item.views || 0} Views</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        item.status === 'published'? "bg-emerald-50 text-emerald-600":
                        item.status === 'scheduled'? "bg-blue-50 text-blue-600":
                        "bg-amber-50 text-amber-600")}>
                        {item.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 flex-shrink-0 justify-end w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                {isDeleted ? (
                  <>
                    {allowRestore && (
                      <button
                        onClick={() => handleRestore(item)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1 transition-all">
                        <RotateCcw size={14} /> Restore
                      </button>
                    )}
                    {allowPermanent && (
                      <button
                        onClick={() => setPermDeleteTarget(item)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all">
                        <Trash2 size={14} /> Delete Forever
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => togglePublish(item)}
                      className="min-w-[38px] min-h-[38px] p-2 text-slate-400 hover:text-[#083D91] transition-colors rounded-lg hover:bg-slate-50" title={item.status === 'published'? 'Unpublish': 'Publish'}
                    >
                      {item.status === 'published'? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={() => { setCurrentArticle(item); setEditorMode('edit'); }}
                      className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg inline-flex items-center gap-1 transition-all" title="Edit">
                      <Edit size={15} /> Edit
                    </button>
                    {allowDelete && (
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-all" title="Delete Article">
                        <Trash2 size={15} /> Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!loading && filteredNews.length === 0 && (
          <div className="bg-white p-16 rounded-2xl border border-slate-100 text-center text-slate-400 italic">
            {statusFilter === 'deleted'? 'No deleted articles in Trash.': 'No articles match your filter.'}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setCurrentPage(p)}
              className={cn(
                "min-w-[40px] min-h-[40px] px-2 rounded-xl text-xs font-bold transition-all",
                p === safePage ? "bg-[#083D91] text-white": "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmSingleDelete}
        title="Delete Article?" itemName={deleteTarget?.headline}
        description="This action removes the article from the public website and moves it to Trash (visible under the Deleted tab & Recycle Bin)." confirmLabel="Move to Trash" allowPermanentOption={allowPermanent}
      />

      <DeleteConfirmModal
        isOpen={Boolean(permDeleteTarget)}
        onClose={() => setPermDeleteTarget(null)}
        onConfirm={handleConfirmPermanentFromDeleted}
        title="Permanently Delete Article?" itemName={permDeleteTarget?.headline}
        description="This article will be permanently erased from Firestore and cannot be restored." confirmLabel="Delete Forever" isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title={statusFilter === 'deleted'? `Permanently Delete ${selectedIds.size} Deleted Articles?`
          : `Delete ${selectedIds.size} Selected Articles?`}
        description={statusFilter === 'deleted'? `These ${selectedIds.size} trashed article(s) will be permanently erased from Firestore.`
          : `Move ${selectedIds.size} selected article(s) to Trash? They will be removed from the public website immediately.`}
        confirmLabel={statusFilter === 'deleted'? 'Delete Forever': `Move ${selectedIds.size} to Trash`}
        isPermanent={statusFilter === 'deleted'}
        allowPermanentOption={statusFilter !== 'deleted'&& allowPermanent}
        requireTypeDelete={statusFilter === 'deleted'|| selectedIds.size > 5}
      />
    </div>
  );
}
