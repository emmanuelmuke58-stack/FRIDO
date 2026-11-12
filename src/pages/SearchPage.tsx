import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NewsItem, Opportunity } from '../types';
import { Search as SearchIcon, ArrowRight, Newspaper, Briefcase, GraduationCap, ClipboardList, Star, MapPin, Calendar, Building2, ChevronRight, X } from 'lucide-react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

const ICON_MAP: Record<string, any> = {
  news: Newspaper,
  Jobs: Briefcase,
  Scholarships: GraduationCap,
  Tenders: ClipboardList,
  Others: Star,
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') || '';
  
  const [searchTerm, setSearchTerm] = useState(qParam);
  const [results, setResults] = useState<{ type: 'news' | 'opp', data: any }[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'news' | 'jobs' | 'scholarships' | 'tenders'>('all');

  const performSearch = async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      // Note: Full-text search in Firestore is limited without a 3rd party like Algolia.
      // For this app, we'll fetch recently active records and filter client-side 
      // or use simple keyword matching if possible.
      // To satisfy the requirement of "full functional", we'll fetch a larger set and filter.
      
      const [newsSnap, oppsSnap] = await Promise.all([
        getDocs(query(collection(db, 'news'), where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(100))),
        getDocs(query(collection(db, 'opportunities'), where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(100)))
      ]);

      const lowerTerm = term.toLowerCase();

      const newsResults: { type: 'news', data: NewsItem }[] = newsSnap.docs
        .map(d => ({ type: 'news' as const, data: { id: d.id, ...d.data() } as NewsItem }))
        .filter(item => 
          item.data.headline.toLowerCase().includes(lowerTerm) || 
          item.data.summary.toLowerCase().includes(lowerTerm) ||
          item.data.category.toLowerCase().includes(lowerTerm)
        );

      const oppResults: { type: 'opp', data: Opportunity }[] = oppsSnap.docs
        .map(d => ({ type: 'opp' as const, data: { id: d.id, ...d.data() } as Opportunity }))
        .filter(item => 
          item.data.title.toLowerCase().includes(lowerTerm) || 
          item.data.organization.toLowerCase().includes(lowerTerm) ||
          item.data.location.toLowerCase().includes(lowerTerm) ||
          item.data.category.toLowerCase().includes(lowerTerm)
        );

      setResults([...newsResults, ...oppResults]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (qParam) {
      performSearch(qParam);
    }
  }, [qParam]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: searchTerm });
  };

  const filteredResults = results.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'news') return item.type === 'news';
    return item.data.category.toLowerCase() === activeFilter;
  });

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#102B4E] font-montserrat mb-4">Search Portal</h1>
          <p className="text-slate-500 text-lg">Find news, jobs, scholarships and tenders in one place.</p>
        </div>
        
        <form onSubmit={handleSearchSubmit} className="relative mb-8 group">
          <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={24} />
          <input 
            type="text" 
            placeholder="What are you looking for?" 
            className="w-full pl-16 pr-32 py-6 bg-white border-2 border-slate-100 rounded-[2rem] text-xl shadow-2xl shadow-blue-900/5 focus:outline-none focus:border-teal-500 transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              type="button" 
              onClick={() => setSearchTerm('')}
              className="absolute right-32 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-slate-500"
            >
              <X size={20} />
            </button>
          )}
          <button 
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#083D91] hover:bg-[#07366D] text-white px-8 py-4 rounded-3xl font-bold transition-all shadow-lg active:scale-95"
          >
            Search
          </button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-8">
           {[
             { id: 'all', label: 'All Results' },
             { id: 'news', label: 'News' },
             { id: 'jobs', label: 'Jobs' },
             { id: 'scholarships', label: 'Scholarships' },
             { id: 'tenders', label: 'Tenders' },
           ].map(f => (
             <button
               key={f.id}
               onClick={() => setActiveFilter(f.id as any)}
               className={cn(
                 "whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all ring-1 ring-slate-200",
                 activeFilter === f.id ? "bg-[#083D91] text-white ring-[#083D91] shadow-md" : "bg-white text-slate-500 hover:bg-slate-50"
               )}
             >
               {f.label}
             </button>
           ))}
        </div>

        <div className="space-y-4">
          {loading ? (
             <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Searching our database...</p>
             </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredResults.map((item, idx) => {
                const Icon = ICON_MAP[item.type === 'news' ? 'news' : item.data.category] || Star;
                const path = item.type === 'news' ? `/news/${item.data.slug}` : `/${item.data.category.toLowerCase()}/${item.data.slug}`;
                
                return (
                  <motion.div
                    key={`${item.type}-${item.data.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <NavLink 
                      to={path}
                      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-teal-100 transition-all flex items-center justify-between group"
                    >
                      <div className="flex gap-6 min-w-0">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3",
                          item.type === 'news' ? "bg-blue-50 text-blue-600" : "bg-teal-50 text-teal-600"
                        )}>
                          <Icon size={28} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                             <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest px-2 py-0.5 bg-teal-50 rounded">
                               {item.type === 'news' ? item.data.category : item.data.category}
                             </span>
                             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                               {format(new Date(item.type === 'news' ? item.data.publishedAt : item.data.createdAt), 'MMM dd, yyyy')}
                             </span>
                          </div>
                          <h3 className="text-lg md:text-xl font-bold text-[#102B4E] group-hover:text-teal-600 transition-colors truncate">
                            {item.type === 'news' ? item.data.headline : item.data.title}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
                            {item.type === 'news' ? (
                               <p className="line-clamp-1 opacity-70">{item.data.summary}</p>
                            ) : (
                               <>
                                 <span className="flex items-center gap-1.5"><Building2 size={14} /> {item.data.organization}</span>
                                 <span className="flex items-center gap-1.5"><MapPin size={14} /> {item.data.location}</span>
                               </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-teal-500 group-hover:text-white transition-all ml-4 shrink-0">
                        <ChevronRight size={24} />
                      </div>
                    </NavLink>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {!loading && qParam && filteredResults.length === 0 && (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                 <SearchIcon size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-400">No results match your search</h3>
              <p className="text-slate-400 mt-2 italic">Try different keywords or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
