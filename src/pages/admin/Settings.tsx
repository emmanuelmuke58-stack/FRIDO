import React, { useEffect, useState } from 'react';
import { useSettings, WebsiteSettings } from '../../lib/SettingsContext';
import { Save, Globe, Phone, Mail, MapPin, Layout, Share2, Plus, Trash2, Clock, Megaphone, ArrowUp, ArrowDown } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { STATIC_ASSETS } from '../../lib/assets';
import { ArticleAdBanner } from '../../types';

export function SettingsManagement() {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<WebsiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general'| 'hero'| 'ads'| 'social'| 'seo'| 'retention'>('general');
  const [deleteSlideIdx, setDeleteSlideIdx] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(formData);
      await logActivity('settings', 'edit', 'Updated website settings');
      setFeedback({ type: 'success', message: 'Settings saved successfully!'});
    } catch (e: any) {
      console.error(e);
      setFeedback({ type: 'error', message: e?.message || 'Failed to save settings.'});
    } finally {
      setSaving(false);
    }
  };

  const addSlide = () => {
    const newSlide = {
      category: 'New Slide',
      title: 'Exciting Opportunity',
      description: 'Check out this new possibility for your career.',
      buttonText: 'Learn More',
      image: STATIC_ASSETS.rwandaInfrastructure,
      link: '/opportunities'};
    setFormData({ ...formData, heroSlides: [...formData.heroSlides, newSlide] });
  };

  const confirmRemoveSlide = async () => {
    if (deleteSlideIdx === null) return;
    const newSlides = formData.heroSlides.filter((_, i) => i !== deleteSlideIdx);
    const updated = { ...formData, heroSlides: newSlides };
    setFormData(updated);
    await updateSettings(updated);
    await logActivity('settings', 'delete', `Deleted Hero Slide #${deleteSlideIdx + 1}`);
    setDeleteSlideIdx(null);
    setFeedback({ type: 'success', message: 'Hero slide deleted and settings saved.'});
  };

  const updateSlide = (idx: number, field: string, value: string) => {
    const newSlides = [...formData.heroSlides];
    newSlides[idx] = { ...newSlides[idx], [field]: value };
    setFormData({ ...formData, heroSlides: newSlides });
  };

  const sidebarAds: ArticleAdBanner[] = formData.articleSidebarAds || [];

  const addAdBanner = () => {
    const nextAd: ArticleAdBanner = {
      id: `ad-${Date.now()}`,
      title: 'Sponsored Banner',
      imageUrl: STATIC_ASSETS.rwandaEducationBanner,
      linkUrl: '/contact',
      label: 'Kwamamaza',
      enabled: true,
      order: sidebarAds.length + 1,
    };
    setFormData({ ...formData, articleSidebarAds: [...sidebarAds, nextAd] });
  };

  const updateAdBanner = (idx: number, patch: Partial<ArticleAdBanner>) => {
    const updated = [...sidebarAds];
    updated[idx] = { ...updated[idx], ...patch };
    setFormData({ ...formData, articleSidebarAds: updated });
  };

  const removeAdBanner = (idx: number) => {
    const updated = sidebarAds.filter((_, i) => i !== idx).map((ad, i) => ({ ...ad, order: i + 1 }));
    setFormData({ ...formData, articleSidebarAds: updated });
  };

  const moveAdBanner = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= sidebarAds.length) return;
    const copy = [...sidebarAds];
    const [moved] = copy.splice(idx, 1);
    copy.splice(target, 0, moved);
    setFormData({
      ...formData,
      articleSidebarAds: copy.map((ad, i) => ({ ...ad, order: i + 1 })),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">Website Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Configure global appearance, hero slides, SEO, and Trash retention policies.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="min-h-[44px] w-full sm:w-auto justify-center bg-teal-500 hover:bg-teal-600 text-white px-7 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50">
          {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <Save size={20} />}
          Save Changes
        </button>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <aside className="lg:w-64 flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide shrink-0">
          {[
            { id: 'general', label: 'General Info', icon: Globe },
            { id: 'hero', label: 'Hero Slides', icon: Layout },
            { id: 'ads', label: 'Article Ads', icon: Megaphone },
            { id: 'social', label: 'Social Media', icon: Share2 },
            { id: 'seo', label: 'SEO Settings', icon: Globe },
            { id: 'retention', label: 'Trash & Retention', icon: Clock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "min-h-[44px] whitespace-nowrap shrink-0 flex items-center gap-2.5 sm:gap-3 px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold transition-all",
                activeTab === tab.id ? "bg-white text-[#083D91] shadow-sm ring-1 ring-slate-100": "text-slate-500 hover:bg-white/50")}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'general'&& (
            <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Globe size={22} className="text-teal-500 shrink-0"/> General Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website Name</label>
                  <input className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.websiteName} onChange={e => setFormData({ ...formData, websiteName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full min-h-[44px] pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full min-h-[44px] pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Office Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full min-h-[44px] pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                </div>
                <ImageUploadField
                  label="Website Logo"
                  value={formData.logoUrl}
                  onChange={(url) => setFormData({ ...formData, logoUrl: url })}
                  aspectHint="logo"
                  helperText="Displayed in website header, footer, and Admin sidebar."
                />
                <ImageUploadField
                  label="Website Favicon"
                  kind="favicon"
                  aspectHint="1:1"
                  enableCrop={false}
                  value={formData.faviconUrl || ''}
                  onChange={(url) => setFormData({ ...formData, faviconUrl: url })}
                  helperText="Recommended: square PNG, WEBP, or ICO browser tab icon."
                />
              </div>
            </div>
          )}

          {activeTab === 'hero'&& (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-[#102B4E]">Homepage Hero Slides</h3>
                <button onClick={addSlide} className="flex items-center gap-2 text-teal-600 font-bold text-sm hover:underline">
                  <Plus size={18} /> Add Slide
                </button>
              </div>
              <div className="space-y-4">
                {formData.heroSlides.map((slide, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <span className="bg-slate-50 px-3 py-1 rounded-lg text-xs font-bold text-slate-400">Slide #{idx + 1}</span>
                      <button
                        onClick={() => setDeleteSlideIdx(idx)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category Kicker</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-teal-600" value={slide.category} onChange={e => updateSlide(idx, 'category', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Slide Title</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold" value={slide.title} onChange={e => updateSlide(idx, 'title', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Slide Description</label>
                          <textarea className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm h-24 resize-none" value={slide.description} onChange={e => updateSlide(idx, 'description', e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-4">
                        <ImageUploadField
                          label="Slide Background Image"
                          value={slide.image}
                          onChange={(url) => updateSlide(idx, 'image', url)}
                          aspectHint="16:9"
                        />
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Button Text</label>
                          <input className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={slide.buttonText} onChange={e => updateSlide(idx, 'buttonText', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination Link</label>
                          <input className="w-full min-h-[44px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={slide.link} onChange={e => updateSlide(idx, 'link', e.target.value)} placeholder="/news or /jobs/slug"/>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h3 className="text-xl font-bold text-[#102B4E]">Sidebar Advertising Banners</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Upload vertical banners displayed in the right advertising column on single news article and job/opportunity pages. Click &ldquo;Save Changes&rdquo; after editing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addAdBanner}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} /> Add Ad Banner
                </button>
              </div>

              {sidebarAds.length === 0 ? (
                <div className="bg-white p-10 rounded-3xl border border-slate-100 text-center text-slate-400 text-sm">
                  No advertising banners configured. Click &ldquo;Add Ad Banner&rdquo; to upload one.
                </div>
              ) : (
                <div className="space-y-4">
                  {sidebarAds.map((ad, idx) => (
                    <div key={ad.id} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">
                            Banner #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateAdBanner(idx, { enabled: !ad.enabled })}
                            className={cn(
                              'px-3 py-1 rounded-lg text-xs font-bold transition-colors',
                              ad.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            )}
                          >
                            {ad.enabled ? 'Active' : 'Paused'}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveAdBanner(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Move banner up"
                            className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAdBanner(idx, 1)}
                            disabled={idx === sidebarAds.length - 1}
                            aria-label="Move banner down"
                            className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeAdBanner(idx)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ImageUploadField
                          label="Advertisement Image (Vertical Recommended)"
                          value={ad.imageUrl}
                          onChange={(url) => updateAdBanner(idx, { imageUrl: url })}
                          aspectHint="free"
                          enableCrop={false}
                          helperText="Original aspect ratio is preserved automatically in the article sidebar."
                        />
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Ad Title / Alt Text
                            </label>
                            <input
                              type="text"
                              value={ad.title}
                              onChange={(e) => updateAdBanner(idx, { title: e.target.value })}
                              placeholder="Sponsor name or campaign title"
                              className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Destination Link URL
                            </label>
                            <input
                              type="text"
                              value={ad.linkUrl}
                              onChange={(e) => updateAdBanner(idx, { linkUrl: e.target.value })}
                              placeholder="https://example.com or /contact"
                              className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Top Label
                            </label>
                            <input
                              type="text"
                              value={ad.label ?? 'Kwamamaza'}
                              onChange={(e) => updateAdBanner(idx, { label: e.target.value })}
                              placeholder="Kwamamaza or Advertisement"
                              className="w-full min-h-[42px] p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'social'&& (
            <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Share2 size={22} className="text-teal-500 shrink-0"/> Social Presence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {Object.keys(formData.socialLinks).map(key => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize">{key} URL</label>
                    <input
                      className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-mono" value={(formData.socialLinks as any)[key]}
                      onChange={e => setFormData({
                        ...formData,
                        socialLinks: { ...formData.socialLinks, [key]: e.target.value }
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'seo'&& (
            <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-6 sm:space-y-8">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Globe size={22} className="text-teal-500 shrink-0"/> Search Engine Optimization
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Meta Title</label>
                  <input className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={formData.seo.defaultTitle} onChange={e => setFormData({ ...formData, seo: { ...formData.seo, defaultTitle: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Meta Description</label>
                  <textarea className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm h-32 resize-none" value={formData.seo.defaultDescription} onChange={e => setFormData({ ...formData, seo: { ...formData.seo, defaultDescription: e.target.value } })} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'retention'&& (
            <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-6">
              <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Clock size={22} className="text-teal-500 shrink-0"/> Soft Delete & Trash Retention Policy
              </h3>
              <p className="text-sm text-slate-500">
                Configure how long soft-deleted articles, jobs, scholarships, tenders, opportunities, pages, and categories are retained in Trash before becoming eligible for purge.
              </p>
              <div className="max-w-xs space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trash Retention Period (Days)</label>
                <select
                  value={formData.trashRetentionDays || 30}
                  onChange={e => setFormData({ ...formData, trashRetentionDays: Number(e.target.value) })}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold">
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days (Recommended)</option>
                  <option value={60}>60 Days</option>
                  <option value={90}>90 Days</option>
                </select>
              </div>
              <p className="text-xs text-slate-400">
                To configure per-user deletion permissions (Editors deleting own articles, Content Managers deleting within assigned modules), use <strong>User Management</strong>.
              </p>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={deleteSlideIdx !== null}
        onClose={() => setDeleteSlideIdx(null)}
        onConfirm={confirmRemoveSlide}
        title="Delete Hero Slide?" itemName={deleteSlideIdx !== null ? `Slide #${deleteSlideIdx + 1}: ${formData.heroSlides[deleteSlideIdx]?.title}` : undefined}
        description="This will remove the slide from the homepage hero carousel." confirmLabel="Delete Slide"isPermanent
      />
    </div>
  );
}
