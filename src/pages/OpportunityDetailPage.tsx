import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { collection, query, where, getDocs, limit, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Opportunity } from '../types';
import { 
  MapPin, Clock, ArrowRight, Briefcase, GraduationCap, ClipboardList, Star, 
  Building2, Globe, DollarSign, ListChecks, FileCheck, HelpCircle, Calendar, 
  Share2, MessageSquare, Download, Mail, ChevronLeft
} from 'lucide-react';
import { Facebook, Twitter, X } from '../components/ui/SocialIcons';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { cn } from '../lib/utils';

const CATEGORY_CONFIG: Record<string, any> = {
  Jobs: { icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Job Detail' },
  Scholarships: { icon: GraduationCap, color: 'text-teal-600', bg: 'bg-teal-50', label: 'Scholarship Detail' },
  Tenders: { icon: ClipboardList, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Tender Detail' },
  Others: { icon: Star, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Opportunity Detail' },
};

export function OpportunityDetailPage() {
  const { slug } = useParams();
  const [opp, setOpp] = React.useState<Opportunity | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchOpp = async () => {
      try {
        const q = query(collection(db, 'opportunities'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const oppDoc = snap.docs[0];
          const data = { id: oppDoc.id, ...oppDoc.data() } as Opportunity;
          setOpp(data);
          
          // Increment views
          await updateDoc(doc(db, 'opportunities', oppDoc.id), {
            views: increment(1)
          });
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
    if (opp) {
      await updateDoc(doc(db, 'opportunities', opp.id), {
        clicks: increment(1)
      });
      
      // Log analytics
      try {
        const { collection, addDoc } = await import('firebase/firestore');
        await addDoc(collection(db, 'analytics'), {
          type: 'click',
          targetId: opp.id,
          category: opp.category,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
      }

      window.open(opp.applyUrl, '_blank');
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Loading details...</div>;
  if (!opp) return <div className="p-20 text-center">Opportunity not found.</div>;

  const config = CATEGORY_CONFIG[opp.category] || CATEGORY_CONFIG.Others;
  const shareUrl = window.location.href;

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <div className="bg-[#083D91] text-white pt-20 pb-40">
        <div className="max-w-5xl mx-auto px-4">
          <NavLink to={`/${opp.category.toLowerCase()}`} className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-all text-sm font-bold mb-8 group">
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to {opp.category}
          </NavLink>
          
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center p-4 shadow-2xl flex-shrink-0">
               {opp.organizationLogo ? (
                 <img src={opp.organizationLogo} alt={opp.organization} className="w-full h-full object-contain" />
               ) : (
                 <config.icon size={48} className={config.color} />
               )}
            </div>
            <div className="flex-1 space-y-3 md:space-y-4">
               <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest", config.bg, config.color)}>
                 {opp.category}
               </span>
               <h1 className="text-3xl md:text-5xl font-extrabold font-montserrat leading-tight break-words">{opp.title}</h1>
               <div className="flex flex-wrap gap-x-6 md:gap-x-8 gap-y-3 text-[10px] md:text-sm font-bold text-white/80 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 md:gap-2"><Building2 size={14} className="text-teal-400" /> {opp.organization}</span>
                  <span className="flex items-center gap-1.5 md:gap-2"><MapPin size={14} className="text-teal-400" /> {opp.location}</span>
                  <span className="flex items-center gap-1.5 md:gap-2"><Clock size={14} className="text-teal-400" /> Deadline: {format(new Date(opp.deadline), 'MMM dd, yyyy')}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-10 md:-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            <div className="bg-white p-6 md:p-10 rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5">
              <h2 className="text-xl md:text-2xl font-extrabold text-[#102B4E] mb-6 md:mb-8 font-montserrat flex items-center gap-3">
                <FileCheck className="text-teal-500" size={24} /> Description & Overview
              </h2>
              <div 
                className="prose prose-slate max-w-none prose-p:leading-relaxed prose-p:text-slate-600 prose-headings:text-[#102B4E]"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.description) }}
              />

              {opp.responsibilities && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-10 md:mt-12 mb-4 md:mb-6 font-montserrat">Responsibilities</h3>
                  <div className="prose prose-slate max-w-none prose-p:text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.responsibilities) }} />
                </>
              )}

              {opp.requirements && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-10 md:mt-12 mb-4 md:mb-6 font-montserrat">Requirements & Eligibility</h3>
                  <div className="prose prose-slate max-w-none prose-p:text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.requirements) }} />
                </>
              )}

              {opp.benefits && (
                <>
                  <h3 className="text-lg md:text-xl font-bold text-[#102B4E] mt-10 md:mt-12 mb-4 md:mb-6 font-montserrat">Benefits</h3>
                  <div className="prose prose-slate max-w-none prose-p:text-slate-600" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.benefits) }} />
                </>
              )}
            </div>

            <div className="bg-teal-50 p-6 md:p-10 rounded-3xl border border-teal-100 border-l-8 border-l-teal-500">
               <h2 className="text-xl md:text-2xl font-extrabold text-[#07566A] mb-4 font-montserrat">How to Apply</h2>
               <div 
                 className="text-[#07566A] mb-8 leading-relaxed font-medium text-sm md:text-base"
                 dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.applicationInstructions || 'Click the button below to visit the official application portal.') }}
               />
               <button 
                 onClick={handleApply}
                 className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold transition-all shadow-xl shadow-teal-900/20 flex items-center justify-center gap-3 text-sm md:text-base active:scale-95"
               >
                 Go to Official Application Link <ArrowRight size={20} />
               </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
             <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-lg">
                <h3 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-xs">At a Glance</h3>
                <div className="space-y-6">
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Type</p>
                        <p className="text-sm font-bold text-slate-900">{opp.type || 'Standard'}</p>
                      </div>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Remuneration</p>
                        <p className="text-sm font-bold text-slate-900">{opp.salary || 'Not specified'}</p>
                      </div>
                   </div>
                   <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Globe size={20} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
                        <p className="text-sm font-bold text-slate-900">{opp.location}</p>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-[#102B4E] p-8 rounded-3xl text-white shadow-2xl">
                <h3 className="font-bold mb-6">Share this Opportunity</h3>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`)} className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-sm">
                      <Facebook size={16} /> Facebook
                   </button>
                   <button onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}`)} className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold text-sm">
                      <X size={16} /> Twitter
                   </button>
                   <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${shareUrl}`)} className="flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all font-bold text-sm">
                      <MessageSquare size={16} /> WhatsApp
                   </button>
                   <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied!'); }} className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/15 rounded-xl transition-all font-bold text-sm text-white/60">
                      <Share2 size={16} /> Copy Link
                   </button>
                </div>
             </div>

             <div className="p-8 rounded-3xl border border-slate-200 border-dashed text-center">
                <HelpCircle size={32} className="mx-auto text-slate-300 mb-4" />
                <h4 className="font-bold text-slate-600 mb-2">Need Help?</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Having trouble applying? Contact the issuing organization directly for support.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
