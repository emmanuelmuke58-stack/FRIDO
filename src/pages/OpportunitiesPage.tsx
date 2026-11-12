import React from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Opportunity } from '@/src/types';
import { MapPin, Clock, ArrowRight, Briefcase, GraduationCap, ClipboardList, Star } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/src/lib/utils';

const MotionNavLink = motion(NavLink);

const ICON_MAP: Record<string, any> = {
  Jobs: Briefcase,
  Scholarships: GraduationCap,
  Tenders: ClipboardList,
  Others: Star,
};

export function OpportunitiesListingPage() {
  const [opps, setOpps] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const location = useLocation();
  
  const pathSegments = location.pathname.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // Safe string manipulation for category
  const categoryFromPath = React.useMemo(() => {
    if (!lastSegment) return '';
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  }, [lastSegment]);

  const filterCategory = React.useMemo(() => {
    const validCategories = ['Jobs', 'Scholarships', 'Tenders', 'Opportunities'];
    if (!validCategories.includes(categoryFromPath)) return null;
    return categoryFromPath === 'Opportunities' ? null : categoryFromPath;
  }, [categoryFromPath]);

  React.useEffect(() => {
    const fetchOpps = async () => {
      setLoading(true);
      try {
        let q = query(collection(db, 'opportunities'), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
        if (filterCategory) {
          q = query(collection(db, 'opportunities'), where('status', '==', 'active'), where('category', '==', filterCategory), orderBy('createdAt', 'desc'));
        }
        const snapshot = await getDocs(q);
        setOpps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Opportunity)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOpps();
  }, [filterCategory]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">Loading opportunities...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10 md:mb-12">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#102B4E] font-montserrat mb-3 md:mb-4">
            {filterCategory || 'Latest Opportunities'}
          </h1>
          <p className="text-sm md:text-lg text-slate-500 font-medium max-w-2xl">Find the best local and international opportunities curated for Rwanda.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6">
          {opps.map((opp, idx) => {
            const Icon = ICON_MAP[opp.category] || Star;
            return (
              <MotionNavLink
                key={opp.id}
                to={`/${opp.category.toLowerCase()}/${opp.slug}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-xl transition-all group cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6"
              >
                <div className="flex items-center gap-4 md:gap-6">
                  <div className={cn(
                    "w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm",
                    opp.category === 'Jobs' ? "bg-blue-50 text-blue-600" :
                    opp.category === 'Scholarships' ? "bg-teal-50 text-teal-600" :
                    opp.category === 'Tenders' ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-600"
                  )}>
                    <Icon size={24} className="md:w-8 md:h-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base md:text-xl font-bold text-[#102B4E] group-hover:text-teal-600 transition-colors mb-1.5 leading-tight">
                      {opp.title}
                    </h3>
                    <div className="flex flex-wrap gap-y-1.5 gap-x-4 md:gap-x-6 text-[11px] md:text-sm text-slate-400 font-medium">
                      <span className="font-bold text-slate-600 uppercase tracking-wider">{opp.organization}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={12} /> {opp.location}</span>
                      <span className="flex items-center gap-1.5 font-bold text-red-500/80">
                        <Clock size={12} /> {new Date(opp.deadline).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-widest",
                    opp.category === 'Jobs' ? "bg-blue-100 text-blue-700" :
                    opp.category === 'Scholarships' ? "bg-teal-100 text-teal-700" :
                    opp.category === 'Tenders' ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                  )}>
                    {opp.category}
                  </span>
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-sm">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </MotionNavLink>
            );
          })}
        </div>

        {opps.length === 0 && (
          <div className="bg-white rounded-2xl p-20 text-center border border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
              <Star size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-400">No opportunities found</h3>
            <p className="text-slate-400 mt-2">Check back later for new updates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
