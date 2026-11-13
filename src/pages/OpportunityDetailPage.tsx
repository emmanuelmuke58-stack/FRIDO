import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Opportunity } from '../types';
import {
  MapPin, Clock, ArrowRight, Briefcase, GraduationCap, ClipboardList, Star,
  Building2, Globe, DollarSign, FileCheck, HelpCircle,
  Share2, MessageSquare, ChevronLeft, Download, X as CloseIcon, Maximize2, Image as ImageIcon
} from 'lucide-react';
import { Facebook, X } from '../components/ui/SocialIcons';
import DOMPurify from 'dompurify';
import { cn, safeFormatDate } from '../lib/utils';
import { isOpportunityExpired } from '../lib/publicData';

const CATEGORY_CONFIG: Record<string, any> = {
  Jobs: { icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Job Detail'},
  Scholarships: { icon: GraduationCap, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Scholarship Detail'},
  Tenders: { icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Tender Detail'},
  Others: { icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Opportunity Detail'},
};

export function OpportunityDetailPage() {
  const { slug } = useParams();
  const [opp, setOpp] = React.useState<Opportunity | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);
  const [applyNotice, setApplyNotice] = React.useState<string | null>(null);
  const [logoError, setLogoError] = React.useState(false);
  const [zoomedGalleryImg, setZoomedGalleryImg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLogoError(false);
  }, [opp?.organizationLogo]);

  React.useEffect(() => {
    if (!zoomedGalleryImg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedGalleryImg(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomedGalleryImg]);

  React.useEffect(() => {
    const fetchOpp = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'opportunities'),
          where('status', '==', 'active')
        );
        const snap = await getDocs(q);
        const now = new Date();
        const matched = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Opportunity))
          .find(o => o.slug === slug && !isOpportunityExpired(o, now)) || null;

        if (matched) {
          setOpp(matched);

          updateDoc(doc(db, 'opportunities', matched.id), {
            views: increment(1)
          }).catch(err => console.warn('View increment skipped:', err));
        } else {
          setOpp(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOpp();
    window.scrollTo(0, 0);
  }, [slug]);

  const handleApply = async () => {
    if (!opp) return;

    updateDoc(doc(db, 'opportunities', opp.id), {
      clicks: increment(1)
    }).catch(err => console.warn('Click increment skipped:', err));

    addDoc(collection(db, 'analytics'), {
      type: 'click',
      targetId: opp.id,
      category: opp.category,
      timestamp: new Date().toISOString()
    }).catch(() => {});

    if (opp.applyUrl) {
      window.open(opp.applyUrl, '_blank', 'noopener,noreferrer');
    } else {
      setApplyNotice('Please follow the application instructions listed above to apply.');
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Loading details...</div>;
  if (!opp) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h2 className="text-3xl font-bold text-slate-900">Opportunity Not Found</h2>
      <NavLink to="/opportunities" className="bg-[#083D91] text-white px-8 py-3 rounded-xl font-bold mt-8 inline-block">Browse Opportunities</NavLink>
    </div>
  );

  const config = CATEGORY_CONFIG[opp.category] || CATEGORY_CONFIG.Others;
  const shareUrl = window.location.href;
  const backPath = `/${opp.category === 'Others'? 'opportunities': opp.category.toLowerCase()}`;

  return (
    <div className="bg-slate-50 min-h-screen pb-16 sm:pb-20">
      <div className="bg-[#083D91] text-white pt-8 pb-20 sm:pt-12 sm:pb-28 md:pt-16 md:pb-36">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <NavLink to={backPath} className="min-h-[44px] inline-flex items-center gap-2 text-white/75 hover:text-white transition-all text-xs sm:text-sm font-bold mb-5 sm:mb-8 group">
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform"/> Back to {opp.category}
          </NavLink>

          <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center p-3 sm:p-4 shadow-2xl flex-shrink-0 overflow-hidden">
              {opp.organizationLogo && !logoError ? (
                <img
                  src={opp.organizationLogo}
                  alt={opp.organization}
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <config.icon size={40} className={config.color} />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2.5 sm:space-y-3.5">
              <span className={cn("inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", config.bg, config.color)}>
                {opp.subCategory || opp.category}
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight break-words">{opp.title}</h1>
              <div className="flex flex-wrap gap-x-5 md:gap-x-8 gap-y-2 text-xs md:text-sm font-bold text-white/85 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 md:gap-2"><Building2 size={14} className="text-teal-400 shrink-0"/> {opp.organization}</span>
                <span className="flex items-center gap-1.5 md:gap-2"><MapPin size={14} className="text-teal-400 shrink-0"/> {opp.location}</span>
                <span className="flex items-center gap-1.5 md:gap-2"><Clock size={14} className="text-teal-400 shrink-0"/> Deadline: {safeFormatDate(opp.deadline, 'MMM dd, yyyy')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-10 md:-mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 min-w-0 space-y-6 md:space-y-8">
            {opp.coverImageUrl && (
              <div className="bg-white p-2 sm:p-3 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5">
                <button
                  type="button"
                  onClick={() => setZoomedGalleryImg(opp.coverImageUrl!)}
                  className="w-full block aspect-[16/9] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 relative group cursor-zoom-in"
                >
                  <img
                    src={opp.coverImageUrl}
                    alt={opp.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <span className="absolute bottom-3 right-3 bg-[#102B4E]/80 text-white p-2 rounded-xl opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <Maximize2 size={16} />
                  </span>
                </button>
              </div>
            )}

            <div className="bg-white p-5 sm:p-7 md:p-10 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5">
              <h2 className="text-xl md:text-2xl font-bold text-[#102B4E] mb-5 md:mb-7 flex items-center gap-3">
                <FileCheck className="text-teal-500 shrink-0" size={24} /> Description & Overview
              </h2>
              <div
                className="article-prose max-w-none overflow-x-clip" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.description) }}
              />

              {opp.responsibilities && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-8 md:mt-10 mb-3.5 md:mb-5">Responsibilities</h3>
                  <div className="article-prose max-w-none overflow-x-clip" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.responsibilities) }} />
                </>
              )}

              {opp.requirements && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-8 md:mt-10 mb-3.5 md:mb-5">Requirements & Eligibility</h3>
                  <div className="article-prose max-w-none overflow-x-clip" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.requirements) }} />
                </>
              )}

              {opp.benefits && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-8 md:mt-10 mb-3.5 md:mb-5">Benefits</h3>
                  <div className="article-prose max-w-none overflow-x-clip" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.benefits) }} />
                </>
              )}
            </div>

            <div className="bg-teal-50/90 p-5 sm:p-7 md:p-9 rounded-2xl sm:rounded-3xl border border-teal-200">
              <h2 className="text-xl md:text-2xl font-bold text-[#07566A] mb-3.5">How to Apply</h2>
              <div
                className="text-[#07566A] mb-6 sm:mb-8 leading-relaxed font-medium text-sm md:text-base break-words" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.applicationInstructions || 'Click the button below to visit the official application portal.') }}
              />
              <div className="flex flex-wrap gap-3">
                {opp.applyUrl && (
                  <button
                    onClick={handleApply}
                    className="min-h-[48px] w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-6 md:px-9 py-3.5 md:py-4 rounded-2xl font-bold transition-all shadow-xl shadow-teal-900/20 flex items-center justify-center gap-3 text-sm md:text-base active:scale-95">
                    Go to Official Application Link <ArrowRight size={20} />
                  </button>
                )}
                {opp.downloadUrl && (
                  <a
                    href={opp.downloadUrl.includes('/api/media/') ? `${opp.downloadUrl}${opp.downloadUrl.includes('?') ? '&' : '?'}download=1` : opp.downloadUrl}
                    target="_blank" rel="noopener noreferrer" className="min-h-[48px] w-full sm:w-auto bg-[#083D91] hover:bg-[#07366D] text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-bold transition-all shadow-xl flex items-center justify-center gap-3 text-sm md:text-base">
                    <Download size={18} /> Download Documents
                  </a>
                )}
              </div>
              {applyNotice && (
                <p className="mt-4 text-sm font-medium text-[#07566A]">{applyNotice}</p>
              )}
            </div>

            {opp.galleryImages && opp.galleryImages.length > 0 && (
              <div className="bg-white p-5 sm:p-7 md:p-9 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-lg space-y-4">
                <h2 className="text-lg md:text-xl font-bold text-[#102B4E] flex items-center gap-2.5">
                  <ImageIcon size={20} className="text-teal-500 shrink-0" /> Venue &amp; Event Gallery
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {opp.galleryImages.map((imgUrl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setZoomedGalleryImg(imgUrl)}
                      className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group cursor-zoom-in"
                    >
                      <img
                        src={imgUrl}
                        alt={`${opp.title} photo ${idx + 1}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6 min-w-0">
            <div className="bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-lg">
              <h3 className="font-bold text-slate-900 mb-5 uppercase tracking-widest text-xs">At a Glance</h3>
              <div className="space-y-5">
                <div className="flex gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <Briefcase size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Type</p>
                    <p className="text-sm font-bold text-slate-900 break-words">{opp.type || 'Standard'}</p>
                  </div>
                </div>
                <div className="flex gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <DollarSign size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Remuneration / Award</p>
                    <p className="text-sm font-bold text-slate-900 break-words">{opp.salary || 'Not specified'}</p>
                  </div>
                </div>
                <div className="flex gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
                    <Globe size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
                    <p className="text-sm font-bold text-slate-900 break-words">{opp.location}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#102B4E] p-5 sm:p-7 rounded-2xl sm:rounded-3xl text-white shadow-2xl">
              <h3 className="font-bold mb-5">Share this Opportunity</h3>
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)} className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-xs sm:text-sm">
                  <Facebook size={16} /> Facebook
                </button>
                <button onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`)} className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-xs sm:text-sm">
                  <X size={16} /> Twitter
                </button>
                <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareUrl)}`)} className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all font-bold text-xs sm:text-sm">
                  <MessageSquare size={16} /> WhatsApp
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-3 bg-white/5 hover:bg-white/15 rounded-xl transition-all font-bold text-xs sm:text-sm text-white/80">
                  <Share2 size={16} /> {copied ? 'Copied!': 'Copy Link'}
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 border-dashed text-center">
              <HelpCircle size={32} className="mx-auto text-slate-300 mb-4"/>
              <h4 className="font-bold text-slate-600 mb-2">Need Help?</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Having trouble applying? Contact the issuing organization directly or reach out via our Contact page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {zoomedGalleryImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded gallery photo"
          onClick={() => setZoomedGalleryImg(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setZoomedGalleryImg(null)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
          >
            <CloseIcon size={22} />
          </button>
          <img
            src={zoomedGalleryImg}
            alt={opp.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
}
