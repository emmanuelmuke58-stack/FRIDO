import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  Layers,
  Layout,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useSettings, WebsiteSettings, DEFAULT_HOMEPAGE_SECTIONS } from '../../lib/SettingsContext';
import {
  CategoryItem,
  HeroSlide,
  HomepageSectionConfig,
  NewsItem,
  Opportunity,
} from '../../types';
import {
  invalidatePublicCache,
  isNewsPubliclyVisible,
  isOpportunityExpired,
  getOpportunityRoutePath,
} from '../../lib/publicData';
import { logActivity } from '../../lib/services';
import { STATIC_ASSETS } from '../../lib/assets';
import { cn, extractErrorMessage, safeFormatDate } from '../../lib/utils';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';

type TabKey = 'slides'| 'sections'| 'featured'| 'banners';

export function HomepageManagement() {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<WebsiteSettings>(settings);
  const [activeTab, setActiveTab] = useState<TabKey>('slides');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Live content from Firestore for slide linking & featured curation
  const [publishedNews, setPublishedNews] = useState<NewsItem[]>([]);
  const [activeOpps, setActiveOpps] = useState<Opportunity[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  // Slide editor state
  const [editingSlideIdx, setEditingSlideIdx] = useState<number | null>(null);
  const [slideDraft, setSlideDraft] = useState<HeroSlide | null>(null);
  const [deleteSlideIdx, setDeleteSlideIdx] = useState<number | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const loadContent = async () => {
    setLoadingContent(true);
    try {
      const now = new Date();
      const [newsSnap, oppSnap, catSnap] = await Promise.all([
        getDocs(query(collection(db, 'news'), where('status', '==', 'published'))),
        getDocs(query(collection(db, 'opportunities'), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'categories'), where('status', '==', 'active'))),
      ]);

      setPublishedNews(
        newsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as NewsItem))
          .filter((n) => isNewsPubliclyVisible(n, now))
          .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
      );
      setActiveOpps(
        oppSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Opportunity))
          .filter((o) => !isOpportunityExpired(o, now))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
      setCategories(
        catSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CategoryItem))
      );
    } catch (e) {
      console.error('Failed to load homepage content sources:', e);
    } finally {
      setLoadingContent(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const persistSettings = async (next: WebsiteSettings, logMsg: string, successMsg: string) => {
    setSaving(true);
    try {
      await updateSettings(next);
      invalidatePublicCache();
      await logActivity('settings', 'edit', logMsg);
      setFeedback({ type: 'success', message: successMsg });
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to save homepage settings.') });
    } finally {
      setSaving(false);
    }
  };

  // --- Slide Helpers ---
  const slides = formData.heroSlides || [];

  const openNewSlide = () => {
    setEditingSlideIdx(null);
    setSlideDraft({
      id: `slide-${Date.now()}`,
      category: 'RWANDA OPPORTUNITIES',
      title: '',
      description: '',
      buttonText: 'Explore Opportunities',
      link: '/opportunities',
      secondaryButtonText: '',
      secondaryLink: '',
      image: STATIC_ASSETS.kigaliPanoramaHero,
      status: 'published',
      order: slides.length + 1,
      featuredType: 'custom',
    });
  };

  const openEditSlide = (idx: number) => {
    setEditingSlideIdx(idx);
    setSlideDraft({ ...slides[idx] });
  };

  const handleLinkRecordToSlide = (value: string) => {
    if (!slideDraft || !value) return;
    const [type, id] = value.split('::');
    if (type === 'news') {
      const item = publishedNews.find((n) => n.id === id);
      if (item) {
        setSlideDraft({
          ...slideDraft,
          featuredType: 'news',
          featuredId: item.id,
          category: item.category || 'News',
          title: item.headline,
          description: item.summary || item.subtitle || '',
          buttonText: 'Read Article',
          link: `/news/${item.slug}`,
          image: item.imageUrl || slideDraft.image,
          publishedAt: item.publishedAt,
        });
      }
    } else if (type === 'opportunity') {
      const opp = activeOpps.find((o) => o.id === id);
      if (opp) {
        setSlideDraft({
          ...slideDraft,
          featuredType: 'opportunity',
          featuredId: opp.id,
          category: `${opp.category}${opp.subCategory ? ` · ${opp.subCategory}` : ''}`,
          title: opp.title,
          description: `${opp.organization} — ${opp.location}. Deadline: ${safeFormatDate(opp.deadline, 'MMM dd, yyyy')}.`,
          buttonText: 'View Opportunity',
          link: getOpportunityRoutePath(opp),
          publishedAt: opp.createdAt,
        });
      }
    }
  };

  const saveSlideDraft = async () => {
    if (!slideDraft || !slideDraft.title.trim()) {
      setFeedback({ type: 'error', message: 'Slide title is required.'});
      return;
    }
    const updatedSlides = [...slides];
    if (editingSlideIdx !== null) {
      updatedSlides[editingSlideIdx] = slideDraft;
    } else {
      updatedSlides.push(slideDraft);
    }
    const normalizedSlides = updatedSlides.map((s, i) => ({ ...s, order: i + 1 }));
    const next = { ...formData, heroSlides: normalizedSlides };
    setFormData(next);
    setSlideDraft(null);
    setEditingSlideIdx(null);
    await persistSettings(
      next,
      `Saved hero slide: ${slideDraft.title}`,
      'Hero slide saved and published to homepage.');
  };

  const moveSlide = async (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= slides.length) return;
    const copy = [...slides];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    const reordered = copy.map((s, i) => ({ ...s, order: i + 1 }));
    const next = { ...formData, heroSlides: reordered };
    setFormData(next);
    await persistSettings(next, 'Reordered homepage hero slides', 'Hero slide order updated.');
  };

  const toggleSlideStatus = async (idx: number) => {
    const copy = [...slides];
    const cur = copy[idx];
    const nextStatus: 'published'| 'draft'= cur.status === 'draft'? 'published': 'draft';
    copy[idx] = { ...cur, status: nextStatus };
    const next = { ...formData, heroSlides: copy };
    setFormData(next);
    await persistSettings(
      next,
      `Set hero slide "${cur.title}"to ${nextStatus}`,
      `Slide "${cur.title}"is now ${nextStatus}.`
    );
  };

  const confirmDeleteSlide = async () => {
    if (deleteSlideIdx === null) return;
    const removed = slides[deleteSlideIdx];
    const updated = slides
      .filter((_, i) => i !== deleteSlideIdx)
      .map((s, i) => ({ ...s, order: i + 1 }));
    const next = { ...formData, heroSlides: updated };
    setFormData(next);
    setDeleteSlideIdx(null);
    await persistSettings(
      next,
      `Deleted hero slide: ${removed?.title || `#${deleteSlideIdx + 1}`}`,
      'Hero slide deleted.');
  };

  // --- Section Helpers ---
  const sections: HomepageSectionConfig[] =
    formData.homepage?.sections && formData.homepage.sections.length > 0
      ? formData.homepage.sections
      : DEFAULT_HOMEPAGE_SECTIONS;

  const updateSection = (id: HomepageSectionConfig['id'], patch: Partial<HomepageSectionConfig>) => {
    const updated = sections.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setFormData({
      ...formData,
      homepage: { ...formData.homepage, sections: updated },
    });
  };

  const moveSection = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= sections.length) return;
    const copy = [...sections];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    const reordered = copy.map((s, i) => ({ ...s, order: i + 1 }));
    setFormData({
      ...formData,
      homepage: { ...formData.homepage, sections: reordered },
    });
  };

  // --- Featured Content Toggle ---
  const toggleFeaturedOpportunity = async (opp: Opportunity) => {
    const nextVal = !opp.featured;
    try {
      await updateDoc(doc(db, 'opportunities', opp.id), { featured: nextVal });
      setActiveOpps((prev) =>
        prev.map((o) => (o.id === opp.id ? { ...o, featured: nextVal } : o))
      );
      invalidatePublicCache();
      await logActivity(
        'settings',
        'edit',
        `${nextVal ? 'Featured': 'Unfeatured'} opportunity on homepage: ${opp.title}`,
        opp.id
      );
      setFeedback({
        type: 'success',
        message: `"${opp.title}"${nextVal ? 'added to': 'removed from'} Featured Opportunities.`,
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(e, 'Failed to update featured status.'),
      });
    }
  };

  const toggleFeaturedNews = async (article: NewsItem) => {
    const nextVal = !article.featured;
    try {
      await updateDoc(doc(db, 'news', article.id), { featured: nextVal });
      setPublishedNews((prev) =>
        prev.map((n) => (n.id === article.id ? { ...n, featured: nextVal } : n))
      );
      invalidatePublicCache();
      await logActivity(
        'settings',
        'edit',
        `${nextVal ? 'Featured': 'Unfeatured'} article: ${article.headline}`,
        article.id
      );
      setFeedback({
        type: 'success',
        message: `"${article.headline}"${nextVal ? 'marked as featured': 'unfeatured'}.`,
      });
    } catch (e: any) {
      setFeedback({
        type: 'error',
        message: extractErrorMessage(e, 'Failed to update article featured status.'),
      });
    }
  };

  const featuredOppCount = activeOpps.filter((o) => o.featured).length;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">
            Website Management — Homepage
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Control hero slides, homepage sections, featured opportunities, and promotional banners synced live to Firestore.
          </p>
        </div>
        <button
          type="button" onClick={() =>
            persistSettings(formData, 'Updated Homepage configuration', 'Homepage settings saved!')
          }
          disabled={saving}
          className="min-h-[44px] w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-6 sm:px-7 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer">
          {saving ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>
          ) : (
            <Save size={18} />
          )}
          <span>Save Homepage Changes</span>
        </button>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        {[
          { id: 'slides', label: `Hero Slides (${slides.length})`, icon: Layout },
          { id: 'sections', label: 'Sections & Order', icon: Layers },
          { id: 'featured', label: `Featured Content (${featuredOppCount})`, icon: Star },
          { id: 'banners', label: 'Promo & CTA Banners', icon: Sparkles },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button" onClick={() => setActiveTab(tab.id as TabKey)}
            className={cn(
              'min-h-[40px] whitespace-nowrap shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
              activeTab === tab.id
                ? 'bg-[#083D91] text-white shadow-sm': 'text-slate-600 hover:bg-slate-50')}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: HERO SLIDES */}
      {activeTab === 'slides'&& (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#102B4E]">Hero Carousel Slides</h2>
              <p className="text-xs text-slate-500">
                Only published slides appear in the public homepage carousel.
              </p>
            </div>
            <button
              type="button" onClick={openNewSlide}
              className="bg-[#083D91] hover:bg-[#07366D] text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
              <Plus size={16} /> Add Hero Slide
            </button>
          </div>

          {slideDraft && (
            <div className="bg-white p-6 rounded-3xl border-2 border-teal-200 shadow-md space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-[#102B4E]">
                  {editingSlideIdx !== null ? 'Edit Hero Slide': 'Create Hero Slide'}
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    defaultValue="" onChange={(e) => handleLinkRecordToSlide(e.target.value)}
                    className="w-full sm:max-w-xs min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#102B4E]">
                    <option value="">Auto-fill from published DB record...</option>
                    {publishedNews.length > 0 && (
                      <optgroup label="Published News Articles">
                        {publishedNews.slice(0, 15).map((n) => (
                          <option key={n.id} value={`news::${n.id}`}>
                            News: {n.headline.slice(0, 60)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {activeOpps.length > 0 && (
                      <optgroup label="Active Opportunities">
                        {activeOpps.slice(0, 15).map((o) => (
                          <option key={o.id} value={`opportunity::${o.id}`}>
                            {o.category}: {o.title.slice(0, 60)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Category Kicker
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-teal-700" value={slideDraft.category}
                      onChange={(e) => setSlideDraft({ ...slideDraft, category: e.target.value })}
                      placeholder="e.g. RWANDA OPPORTUNITIES"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Headline *
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={slideDraft.title}
                      onChange={(e) => setSlideDraft({ ...slideDraft, title: e.target.value })}
                      placeholder="Enter slide headline"/>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Short Description
                    </label>
                    <textarea
                      rows={3}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none" value={slideDraft.description}
                      onChange={(e) => setSlideDraft({ ...slideDraft, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <ImageUploadField
                    label="Slide Image"
                    value={slideDraft.image}
                    onChange={(url) => setSlideDraft({ ...slideDraft, image: url })}
                    aspectHint="16:9"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Primary CTA Label
                      </label>
                      <input
                        className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={slideDraft.buttonText}
                        onChange={(e) => setSlideDraft({ ...slideDraft, buttonText: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Primary Link
                      </label>
                      <input
                        className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" value={slideDraft.link}
                        onChange={(e) => setSlideDraft({ ...slideDraft, link: e.target.value })}
                        placeholder="/opportunities"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Secondary CTA (Optional)
                      </label>
                      <input
                        className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={slideDraft.secondaryButtonText || ''}
                        onChange={(e) =>
                          setSlideDraft({ ...slideDraft, secondaryButtonText: e.target.value })
                        }
                        placeholder="Latest News"/>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Secondary Link
                      </label>
                      <input
                        className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" value={slideDraft.secondaryLink || ''}
                        onChange={(e) =>
                          setSlideDraft({ ...slideDraft, secondaryLink: e.target.value })
                        }
                        placeholder="/news"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Status
                      </label>
                      <select
                        className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={slideDraft.status || 'published'}
                        onChange={(e) =>
                          setSlideDraft({
                            ...slideDraft,
                            status: e.target.value as 'published'| 'draft',
                          })
                        }
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft (Hidden)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Display Date (Optional)
                      </label>
                      <input
                        type="date" className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={slideDraft.publishedAt ? slideDraft.publishedAt.slice(0, 10) : ''}
                        onChange={(e) =>
                          setSlideDraft({ ...slideDraft, publishedAt: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button" onClick={() => {
                    setSlideDraft(null);
                    setEditingSlideIdx(null);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">
                  Cancel
                </button>
                <button
                  type="button" onClick={saveSlideDraft}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700">
                  Save Hero Slide
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {slides.map((slide, idx) => (
              <div
                key={slide.id || idx}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4 min-w-0 flex-1 w-full">
                  <div className="w-full sm:w-28 h-36 sm:h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    <img src={slide.image} alt={slide.title} className="w-full h-full object-cover"/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                        #{idx + 1} · {slide.category}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                          slide.status === 'draft'? 'bg-amber-50 text-amber-700': 'bg-emerald-50 text-emerald-700')}
                      >
                        {slide.status || 'published'}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#102B4E] line-clamp-2 sm:truncate">{slide.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{slide.description}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                      {slide.buttonText} → {slide.link}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    type="button" disabled={idx === 0}
                    onClick={() => moveSlide(idx, -1)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" title="Move Up">
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button" disabled={idx === slides.length - 1}
                    onClick={() => moveSlide(idx, 1)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30" title="Move Down">
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button" onClick={() => toggleSlideStatus(idx)}
                    className="min-h-[38px] px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                    {slide.status === 'draft'? <Eye size={14} /> : <EyeOff size={14} />}
                    {slide.status === 'draft'? 'Publish': 'Unpublish'}
                  </button>
                  <button
                    type="button" onClick={() => openEditSlide(idx)}
                    className="min-h-[38px] px-3 py-2 rounded-lg bg-blue-50 text-[#083D91] text-xs font-bold hover:bg-blue-100 inline-flex items-center gap-1">
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    type="button" onClick={() => setDeleteSlideIdx(idx)}
                    className="min-h-[38px] px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 inline-flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SECTIONS & ORDER */}
      {activeTab === 'sections'&& (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[#102B4E]">Homepage Sections Configuration</h2>
            <p className="text-xs text-slate-500">
              Enable, disable, reorder, rename, and set record display limits for every homepage section. Click Save Homepage Changes above to publish.
            </p>
          </div>

          <div className="space-y-4">
            {sections.map((sec, idx) => {
              const moduleCats = categories.filter((c) => {
                if (sec.id === 'news') return c.module === 'News';
                if (sec.id === 'jobs') return c.module === 'Jobs';
                if (sec.id === 'scholarships') return c.module === 'Scholarships';
                if (sec.id === 'tenders') return c.module === 'Tenders';
                if (sec.id === 'others') return c.module === 'Others';
                return false;
              });

              return (
                <div
                  key={sec.id}
                  className={cn(
                    'p-5 rounded-2xl border transition-all space-y-4',
                    sec.enabled ? 'border-slate-200 bg-white': 'border-slate-100 bg-slate-50/70 opacity-75')}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                        #{idx + 1} · {sec.id}
                      </span>
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[#102B4E]">
                        <input
                          type="checkbox" checked={sec.enabled}
                          onChange={(e) => updateSection(sec.id, { enabled: e.target.checked })}
                          className="w-4 h-4 rounded text-teal-600"/>
                        <span>{sec.enabled ? 'Visible on Homepage': 'Hidden'}</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button" disabled={idx === 0}
                        onClick={() => moveSection(idx, -1)}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30">
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button" disabled={idx === sections.length - 1}
                        onClick={() => moveSection(idx, 1)}
                        className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30">
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Section Title
                      </label>
                      <input
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#102B4E]" value={sec.title}
                        onChange={(e) => updateSection(sec.id, { title: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Section Subtitle / Description
                      </label>
                      <input
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700" value={sec.description}
                        onChange={(e) => updateSection(sec.id, { description: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                        Max Items
                      </label>
                      <input
                        type="number" min={1}
                        max={12}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-center" value={sec.limit}
                        onChange={(e) =>
                          updateSection(sec.id, {
                            limit: Math.min(12, Math.max(1, Number(e.target.value) || 4)),
                          })
                        }
                      />
                    </div>
                  </div>

                  {moduleCats.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                        Featured Categories Filter (leave empty to show all)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {moduleCats.map((cat) => {
                          const selected = (sec.featuredCategories || []).includes(cat.name);
                          return (
                            <button
                              key={cat.id}
                              type="button" onClick={() => {
                                const cur = sec.featuredCategories || [];
                                const next = selected
                                  ? cur.filter((x) => x !== cat.name)
                                  : [...cur, cat.name];
                                updateSection(sec.id, { featuredCategories: next });
                              }}
                              className={cn(
                                'px-3 py-1 rounded-full text-xs font-bold border transition-colors',
                                selected
                                  ? 'bg-[#083D91] text-white border-[#083D91]': 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-500')}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: FEATURED CONTENT */}
      {activeTab === 'featured'&& (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-[#102B4E]">
                  Featured Active Opportunities ({featuredOppCount} Featured)
                </h2>
                <p className="text-xs text-slate-500">
                  Only active, non-expired listings appear here. Expired listings are excluded automatically from the homepage.
                </p>
              </div>
              <button
                type="button" onClick={loadContent}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#102B4E]">
                Refresh Live DB List
              </button>
            </div>

            {loadingContent ? (
              <p className="text-sm text-slate-400 py-8 text-center">Loading active records...</p>
            ) : activeOpps.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center italic">
                No active non-expired opportunities available to feature yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeOpps.map((opp) => (
                  <div
                    key={opp.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-teal-600">
                        <span>{opp.category}</span>
                        {opp.subCategory && <span>· {opp.subCategory}</span>}
                        <span className="text-slate-400">
                          · Deadline: {safeFormatDate(opp.deadline, 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#102B4E] truncate">{opp.title}</h4>
                      <p className="text-xs text-slate-500 truncate">{opp.organization}</p>
                    </div>
                    <button
                      type="button" onClick={() => toggleFeaturedOpportunity(opp)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer',
                        opp.featured
                          ? 'bg-teal-600 text-white shadow-sm': 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      {opp.featured ? <CheckCircle2 size={14} /> : <Star size={14} />}
                      <span>{opp.featured ? 'Featured on Homepage': 'Set as Featured'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#102B4E] mb-1">
              Featured Published News Articles ({publishedNews.filter((n) => n.featured).length})
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Mark priority news articles to highlight across editorial spots.
            </p>
            {publishedNews.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center italic">
                No published news articles found.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {publishedNews.slice(0, 20).map((article) => (
                  <div
                    key={article.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#083D91]">
                        {article.category} · {article.language} ·{''}
                        {safeFormatDate(article.publishedAt, 'MMM dd, yyyy')}
                      </div>
                      <h4 className="text-sm font-bold text-[#102B4E] truncate">
                        {article.headline}
                      </h4>
                    </div>
                    <button
                      type="button" onClick={() => toggleFeaturedNews(article)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer',
                        article.featured
                          ? 'bg-[#083D91] text-white': 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                    >
                      <Star size={14} />
                      <span>{article.featured ? 'Featured Story': 'Feature Story'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PROMO & CTA BANNERS */}
      {activeTab === 'banners'&& formData.homepage?.promoBanners && (
        <div className="space-y-6">
          {(['education', 'tenders', 'cta'] as const).map((key) => {
            const banner = formData.homepage.promoBanners![key];
            const labelMap = {
              education: 'Spotlight Card 1 — Education & Scholarships',
              tenders: 'Spotlight Card 2 — Tenders & Business',
              cta: 'Wide Bottom CTA Banner',
            };
            return (
              <div
                key={key}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#102B4E]">{labelMap[key]}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Title
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold" value={banner.title}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homepage: {
                            ...formData.homepage,
                            promoBanners: {
                              ...formData.homepage.promoBanners!,
                              [key]: { ...banner, title: e.target.value },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <ImageUploadField
                      label="Banner Image"
                      value={banner.image}
                      aspectHint="16:9"
                      onChange={(url) =>
                        setFormData({
                          ...formData,
                          homepage: {
                            ...formData.homepage,
                            promoBanners: {
                              ...formData.homepage.promoBanners!,
                              [key]: { ...banner, image: url },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Description
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={banner.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homepage: {
                            ...formData.homepage,
                            promoBanners: {
                              ...formData.homepage.promoBanners!,
                              [key]: { ...banner, description: e.target.value },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Button Text
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={banner.buttonText}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homepage: {
                            ...formData.homepage,
                            promoBanners: {
                              ...formData.homepage.promoBanners!,
                              [key]: { ...banner, buttonText: e.target.value },
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Destination Path
                    </label>
                    <input
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono" value={banner.link}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          homepage: {
                            ...formData.homepage,
                            promoBanners: {
                              ...formData.homepage.promoBanners!,
                              [key]: { ...banner, link: e.target.value },
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteSlideIdx !== null}
        onClose={() => setDeleteSlideIdx(null)}
        onConfirm={confirmDeleteSlide}
        title="Delete Hero Slide?" itemName={
          deleteSlideIdx !== null ? slides[deleteSlideIdx]?.title || `Slide #${deleteSlideIdx + 1}` : undefined
        }
        description="This removes the hero slide from the homepage carousel." confirmLabel="Delete Slide"isPermanent
      />
    </div>
  );
}
