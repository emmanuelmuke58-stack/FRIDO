import React, { useEffect, useState } from 'react';
import { useSettings, WebsiteSettings } from '../../lib/SettingsContext';
import { Save, Globe, Phone, Mail, MapPin, Layout, Share2, Plus, Trash, Image as ImageIcon } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';

export function SettingsManagement() {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState<WebsiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'hero' | 'social' | 'seo'>('general');
  const [mediaTarget, setMediaTarget] = useState<{ type: 'logo' | 'favicon' | 'slide'; slideIdx?: number } | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(formData);
      await logActivity('settings', 'edit', 'Updated website settings');
      alert('Settings saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save settings');
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
      image: '/src/assets/images/rwanda_infrastructure_1794481092287.jpg',
      link: '/opportunities'
    };
    setFormData({ ...formData, heroSlides: [...formData.heroSlides, newSlide] });
  };

  const removeSlide = (idx: number) => {
    const newSlides = formData.heroSlides.filter((_, i) => i !== idx);
    setFormData({ ...formData, heroSlides: newSlides });
  };

  const updateSlide = (idx: number, field: string, value: string) => {
    const newSlides = [...formData.heroSlides];
    newSlides[idx] = { ...newSlides[idx], [field]: value };
    setFormData({ ...formData, heroSlides: newSlides });
  };

  const handleMediaSelect = (url: string) => {
    if (!mediaTarget) return;
    if (mediaTarget.type === 'logo') {
      setFormData({ ...formData, logoUrl: url });
    } else if (mediaTarget.type === 'favicon') {
      setFormData({ ...formData, faviconUrl: url });
    } else if (mediaTarget.type === 'slide' && typeof mediaTarget.slideIdx === 'number') {
      updateSlide(mediaTarget.slideIdx, 'image', url);
    }
    setMediaTarget(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Website Settings</h1>
          <p className="text-slate-500 mt-1">Configure global appearance, hero slides and contact info.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all disabled:opacity-50"
        >
          {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={20} />}
          Save Changes
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 flex flex-col gap-1">
          {[
            { id: 'general', label: 'General Info', icon: Globe },
            { id: 'hero', label: 'Hero Slides', icon: Layout },
            { id: 'social', label: 'Social Media', icon: Share2 },
            { id: 'seo', label: 'SEO Settings', icon: Globe },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === tab.id ? "bg-white text-[#083D91] shadow-sm ring-1 ring-slate-100" : "text-slate-500 hover:bg-white/50"
              )}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="flex-1 space-y-6">
          {activeTab === 'general' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Globe size={24} className="text-teal-500" /> General Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Website Name</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.websiteName} onChange={e => setFormData({ ...formData, websiteName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Phone</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Office Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Logo URL</label>
                  <div className="flex gap-2">
                    <input className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-mono" value={formData.logoUrl} onChange={e => setFormData({ ...formData, logoUrl: e.target.value })} />
                    <button type="button" onClick={() => setMediaTarget({ type: 'logo' })} className="px-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700">
                      Pick
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Favicon URL</label>
                  <div className="flex gap-2">
                    <input className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-mono" value={formData.faviconUrl || ''} onChange={e => setFormData({ ...formData, faviconUrl: e.target.value })} placeholder="https://..." />
                    <button type="button" onClick={() => setMediaTarget({ type: 'favicon' })} className="px-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold text-slate-700">
                      Pick
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hero' && (
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
                      <button onClick={() => removeSlide(idx)} className="text-red-400 hover:text-red-600 transition-colors p-2">
                        <Trash size={18} />
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
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image URL</label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={slide.image} onChange={e => updateSlide(idx, 'image', e.target.value)} />
                            </div>
                            <button type="button" onClick={() => setMediaTarget({ type: 'slide', slideIdx: idx })} className="px-4 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
                              Pick
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Button Text</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm" value={slide.buttonText} onChange={e => updateSlide(idx, 'buttonText', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination Link</label>
                          <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" value={slide.link} onChange={e => updateSlide(idx, 'link', e.target.value)} placeholder="/news or /jobs/slug" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'social' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Share2 size={24} className="text-teal-500" /> Social Presence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.keys(formData.socialLinks).map(key => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest capitalize">{key} URL</label>
                    <input
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-mono"
                      value={(formData.socialLinks as any)[key]}
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

          {activeTab === 'seo' && (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8">
              <h3 className="text-xl font-bold flex items-center gap-2 text-[#102B4E]">
                <Globe size={24} className="text-teal-500" /> Search Engine Optimization
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Meta Title</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={formData.seo.defaultTitle} onChange={e => setFormData({ ...formData, seo: { ...formData.seo, defaultTitle: e.target.value } })} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Default Meta Description</label>
                  <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm h-32 resize-none" value={formData.seo.defaultDescription} onChange={e => setFormData({ ...formData, seo: { ...formData.seo, defaultDescription: e.target.value } })} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaPickerModal
        isOpen={Boolean(mediaTarget)}
        onClose={() => setMediaTarget(null)}
        onSelect={handleMediaSelect}
      />
    </div>
  );
}
