import React from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Opportunity } from '@/src/types';
import { MapPin, Clock, ArrowRight, Briefcase, GraduationCap, ClipboardList, Star } from 'lucide-react';
import { NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, safeFormatDate } from '@/src/lib/utils';
import { isOpportunityExpired } from '@/src/lib/publicData';

const MotionNavLink = motion(NavLink);

const ICON_MAP: Record<string, any> = {
  Jobs: Briefcase,
  Scholarships: GraduationCap,
  Tenders: ClipboardList,
  Others: Star,
};

const SUBCATEGORY_FILTERS: Record<string, { label: string; slug: string }[]> = {
  Jobs: [
    { label: 'All Jobs', slug: ''},
    { label: 'Government', slug: 'government'},
    { label: 'Private Sector', slug: 'private-sector'},
    { label: 'NGO', slug: 'ngo'},
    { label: 'International', slug: 'international'},
  ],
  Scholarships: [
    { label: 'All Scholarships', slug: ''},
    { label: 'Local', slug: 'local'},
    { label: 'International', slug: 'international'},
    { label: 'Undergraduate', slug: 'undergraduate'},
    { label: "Master's", slug: 'masters'},
    { label: 'PhD', slug: 'phd'},
  ],
  Tenders: [
    { label: 'All Tenders', slug: ''},
    { label: 'Government', slug: 'government'},
    { label: 'Private Sector', slug: 'private-sector'},
    { label: 'NGO', slug: 'ngo'},
  ],
  Opportunities: [
    { label: 'All Opportunities', slug: ''},
    { label: 'Internships', slug: 'internships'},
    { label: 'Fellowships', slug: 'fellowships'},
    { label: 'Grants', slug: 'grants'},
    { label: 'Training', slug: 'training'},
    { label: 'Conferences', slug: 'conferences'},
    { label: 'Workshops', slug: 'workshops'},
  ]
};

export function OpportunitiesListingPage() {
  const [opps, setOpps] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const location = useLocation();
  const { subCategory } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const orgParam = (searchParams.get('org') || '').trim();

  const baseSegment = React.useMemo(() => {
    const first = location.pathname.split('/').filter(Boolean)[0] || 'opportunities';
    return first.charAt(0).toUpperCase() + first.slice(1);
  }, [location.pathname]);

  const filterCategory = React.useMemo(() => {
    const validCategories = ['Jobs', 'Scholarships', 'Tenders', 'Opportunities'];
    if (!validCategories.includes(baseSegment)) return null;
    return baseSegment === 'Opportunities'? null : baseSegment;
  }, [baseSegment]);

  React.useEffect(() => {
    const fetchOpps = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'opportunities'), where('status', '==', 'active'));
        const snapshot = await getDocs(q);
        const now = new Date();
        let items = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Opportunity))
          .filter(o => !isOpportunityExpired(o, now));

        if (filterCategory) {
          items = items.filter(o => o.category === filterCategory);
        }

        if (subCategory) {
          const normalized = subCategory.toLowerCase().replace(/-/g, '');
          items = items.filter(o =>
            (o.subCategory || '').toLowerCase().replace(/['-]/g, '') === normalized ||
            (o.subCategory || '').toLowerCase().replace(/['-\s]/g, '') === subCategory.toLowerCase().replace(/['-\s]/g, '') ||
            (o.type || '').toLowerCase().includes(normalized)
          );
        }

        if (orgParam) {
          const targetOrg = orgParam.toLowerCase();
          items = items.filter(o => (o.organization || '').trim().toLowerCase() === targetOrg);
        }

        items.sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || ''));
        setOpps(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOpps();
  }, [filterCategory, subCategory, orgParam]);

  const subFilters = SUBCATEGORY_FILTERS[baseSegment] || SUBCATEGORY_FILTERS.Opportunities;
  const basePath = `/${baseSegment.toLowerCase()}`;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"/>
        <p className="text-slate-500">Loading opportunities...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6 md:mb-10">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-[#102B4E] mb-2.5 md:mb-4">
            {subCategory
              ? `${subCategory.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ${filterCategory || 'Opportunities'}`
              : filterCategory || 'Latest Opportunities'}
          </h1>
          <p className="text-sm md:text-lg text-slate-500 font-medium max-w-2xl">
            Find the best local and international opportunities curated for Rwanda.
          </p>
        </div>

        {/* Sub-Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 md:mb-8 scrollbar-hide">
          {subFilters.map(f => {
            const targetPath = f.slug ? `${basePath}/category/${f.slug}` : basePath;
            const isActive = (!subCategory && !f.slug) || (subCategory?.toLowerCase() === f.slug);
            return (
              <NavLink
                key={f.label}
                to={targetPath}
                className={cn(
                  "min-h-[40px] inline-flex items-center whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border shrink-0",
                  isActive
                    ? "bg-[#083D91] text-white border-[#083D91] shadow-sm": "bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600")}
              >
                {f.label}
              </NavLink>
            );
          })}
        </div>

        {orgParam && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
            <span className="text-slate-600">
              Showing opportunities from <strong className="text-[#102B4E]">{orgParam}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('org');
                setSearchParams(next);
              }}
              className="text-xs font-bold text-[#083D91] hover:underline cursor-pointer"
            >
              Show all employers
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:gap-6">
          {opps.map((opp, idx) => {
            const Icon = ICON_MAP[opp.category] || Star;
            return (
              <MotionNavLink
                key={opp.id}
                to={`/${opp.category === 'Others'? 'opportunities': opp.category.toLowerCase()}/${opp.slug}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-4 sm:p-5 md:p-6 rounded-2xl border border-slate-100 hover:border-teal-200 hover:shadow-xl transition-all group cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 min-w-0">
                <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 md:gap-6 min-w-0 flex-1">
                  <div className={cn(
                    "w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden",
                    opp.organizationLogo
                      ? "bg-white border border-slate-100 p-1.5"
                      : opp.category === 'Jobs'? "bg-blue-50 text-blue-600":
                        opp.category === 'Scholarships'? "bg-teal-50 text-teal-600":
                        opp.category === 'Tenders'? "bg-indigo-50 text-indigo-600": "bg-slate-50 text-slate-600")}>
                    {opp.organizationLogo ? (
                      <img
                        src={opp.organizationLogo}
                        alt={opp.organization}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Icon size={24} className="md:w-8 md:h-8"/>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base md:text-xl font-bold text-[#102B4E] group-hover:text-teal-600 transition-colors mb-1.5 leading-tight break-words">
                      {opp.title}
                    </h3>
                    <div className="flex flex-wrap gap-y-1.5 gap-x-3 sm:gap-x-4 md:gap-x-6 text-xs md:text-sm text-slate-500 font-medium">
                      <span className="font-bold text-slate-600 uppercase tracking-wider">{opp.organization}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={12} /> {opp.location}</span>
                      <span className="flex items-center gap-1.5 font-bold text-red-500/80">
                        <Clock size={12} /> {safeFormatDate(opp.deadline, 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between md:justify-end gap-4 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    opp.category === 'Jobs'? "bg-blue-100 text-blue-700":
                    opp.category === 'Scholarships'? "bg-teal-100 text-teal-700":
                    opp.category === 'Tenders'? "bg-indigo-100 text-indigo-700": "bg-slate-100 text-slate-700")}>
                    {opp.subCategory || opp.category}
                  </span>
                  <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-sm">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </MotionNavLink>
            );
          })}
        </div>

        {opps.length === 0 && (
          <div className="bg-white rounded-2xl p-10 sm:p-16 text-center border border-slate-100">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
              <Star size={36} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-500">No opportunities found</h3>
            <p className="text-sm text-slate-400 mt-2">Check back later for new updates.</p>
          </div>
        )}
      </div>
    </div>
  );
}
