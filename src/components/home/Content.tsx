import React from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { NewsItem, Opportunity } from '../../types';
import { Calendar, MapPin, Clock, ArrowRight, Briefcase, GraduationCap, ClipboardList, Star, ChevronRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const ICON_MAP: Record<string, any> = {
  Jobs: Briefcase,
  Scholarships: GraduationCap,
  Tenders: ClipboardList,
  Others: Star,
};

const MotionNavLink = motion(NavLink);

export function MainContent() {
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [opps, setOpps] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date().toISOString();
        const newsQ = query(
          collection(db, 'news'), 
          where('status', '==', 'published'), 
          where('publishedAt', '<=', now),
          orderBy('publishedAt', 'desc'), 
          limit(3)
        );
        const oppsQ = query(
          collection(db, 'opportunities'), 
          where('status', '==', 'active'), 
          orderBy('createdAt', 'desc'), 
          limit(4)
        );
        
        const [newsSnap, oppsSnap] = await Promise.all([getDocs(newsQ), getDocs(oppsQ)]);
        
        setNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
        setOpps(oppsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Opportunity)));
      } catch (e) {
        console.error("Home data fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
      {/* Latest News */}
      <div>
        <div className="flex justify-between items-center mb-8 border-l-4 border-teal-600 pl-4">
          <h2 className="text-xl md:text-2xl font-bold text-[#102B4E] font-montserrat">Latest News (Kinyarwanda)</h2>
          <NavLink to="/news" className="text-teal-600 text-xs md:text-sm font-bold flex items-center gap-1 hover:underline">
            See all <ArrowRight size={14} />
          </NavLink>
        </div>
        <div className="space-y-6 md:space-y-8">
          {news.map((item) => (
            <MotionNavLink
              key={item.id}
              to={`/news/${item.slug}`}
              initial={{ x: -20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="flex gap-4 md:gap-6 group cursor-pointer"
            >
              <div className="w-24 h-18 md:w-32 md:h-24 flex-shrink-0 overflow-hidden rounded-lg shadow-sm">
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <h3 className="text-sm md:text-lg font-bold text-[#102B4E] mb-1.5 group-hover:text-teal-600 transition-colors line-clamp-2 leading-tight tracking-tight">
                  {item.headline}
                </h3>
                <span className="flex items-center gap-1 text-[10px] md:text-xs text-slate-400 font-medium uppercase tracking-wider">
                  <Calendar size={10} /> {new Date(item.publishedAt).toLocaleDateString()}
                </span>
              </div>
            </MotionNavLink>
          ))}
          {!loading && news.length === 0 && (
            <div className="p-8 bg-slate-50 rounded-xl text-center text-slate-400 italic">No news published yet.</div>
          )}
        </div>
      </div>

      {/* Latest Opportunities */}
      <div>
        <div className="flex justify-between items-center mb-8 border-l-4 border-[#083D91] pl-4">
          <h2 className="text-xl md:text-2xl font-bold text-[#102B4E] font-montserrat">Latest Opportunities</h2>
          <NavLink to="/opportunities" className="text-teal-600 text-xs md:text-sm font-bold flex items-center gap-1 hover:underline">
            See all <ArrowRight size={14} />
          </NavLink>
        </div>
        <div className="space-y-4">
          {opps.map((opp) => {
            const Icon = ICON_MAP[opp.category] || Star;
            return (
              <MotionNavLink
                key={opp.id}
                to={`/${opp.category === 'Others' ? 'opportunities' : opp.category.toLowerCase()}/${opp.slug}`}
                initial={{ x: 20, opacity: 0 }}
                whileInView={{ x: 0, opacity: 1 }}
                viewport={{ once: true }}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-slate-50 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className={cn(
                    "w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                    opp.category === 'Jobs' ? "bg-blue-50 text-blue-600" :
                    opp.category === 'Scholarships' ? "bg-teal-50 text-teal-600" :
                    "bg-slate-50 text-slate-600"
                  )}>
                    <Icon size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-base font-bold text-[#102B4E] group-hover:text-teal-600 transition-colors truncate">
                      {opp.title} <span className="font-normal text-slate-400">— {opp.organization}</span>
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-[10px] md:text-[11px] text-slate-400 font-medium">
                      <span className="flex items-center gap-1"><MapPin size={10} /> {opp.location}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> Deadline: {new Date(opp.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-teal-600 transition-colors flex-shrink-0" />
              </MotionNavLink>
            );
          })}
          {!loading && opps.length === 0 && (
            <div className="p-8 bg-slate-50 rounded-xl text-center text-slate-400 italic">No opportunities active yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export function PromotionalBanner() {
  return (
    <section className="relative min-h-[300px] md:h-[350px] overflow-hidden my-12 md:my-20">
      <img
        src="/src/assets/images/rwanda_education_banner_1794481091149.jpg"
        alt="Promotional Banner"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-teal-900/70 backdrop-blur-[2px] flex items-center py-12">
        <div className="max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-xl text-white">
            <h2 className="text-3xl md:text-5xl font-extrabold font-montserrat mb-4 leading-tight">Your Future, Our Priority</h2>
            <p className="text-sm md:text-xl opacity-90 mb-8 font-inter leading-relaxed">
              Find the best jobs, scholarships, tenders and opportunities in Rwanda and beyond. We help you take the next big step.
            </p>
            <NavLink to="/opportunities" className="bg-white text-[#0D9488] px-8 py-4 rounded-xl font-bold transition-all shadow-xl hover:bg-teal-50 active:scale-95 inline-flex items-center gap-2 text-sm md:text-base">
              Explore Opportunities <ArrowRight size={18} />
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  );
}
