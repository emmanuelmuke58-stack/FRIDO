import React from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { NewsItem } from '@/src/types';
import { Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { NavLink, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/src/lib/utils';

const NEWS_FILTERS = [
  { label: 'All News', path: '/news' },
  { label: 'Kinyarwanda', path: '/news?lang=Kinyarwanda' },
  { label: 'English', path: '/news?lang=English' },
  { label: 'Business', path: '/news/category/business' },
  { label: 'Economy', path: '/news/category/economy' },
  { label: 'Technology', path: '/news/category/technology' },
  { label: 'Education', path: '/news/category/education' },
  { label: 'International', path: '/news/category/international' },
];

export function NewsListingPage() {
  const { category } = useParams();
  const [searchParams] = useSearchParams();
  const langParam = searchParams.get('lang');
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        let q = query(
          collection(db, 'news'),
          where('status', '==', 'published'),
          where('publishedAt', '<=', now),
          orderBy('publishedAt', 'desc')
        );

        if (category) {
          const catMap: Record<string, string> = {
            'rwanda-kinyarwanda': 'News',
            'rwanda-english': 'News',
            'business': 'Business',
            'economy': 'Economy',
            'education': 'Updates',
            'technology': 'Technology',
            'international': 'International',
            'news': 'News',
            'infrastructure': 'Infrastructure',
            'updates': 'Updates'
          };
          const targetCat = catMap[category.toLowerCase()] || category.charAt(0).toUpperCase() + category.slice(1);
          q = query(
            collection(db, 'news'),
            where('status', '==', 'published'),
            where('publishedAt', '<=', now),
            where('category', '==', targetCat),
            orderBy('publishedAt', 'desc')
          );
        }

        const snapshot = await getDocs(q);
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsItem));
        if (langParam) {
          items = items.filter(i => i.language?.toLowerCase() === langParam.toLowerCase());
        } else if (category?.toLowerCase() === 'rwanda-kinyarwanda') {
          items = items.filter(i => i.language === 'Kinyarwanda');
        } else if (category?.toLowerCase() === 'rwanda-english') {
          items = items.filter(i => i.language === 'English');
        }
        setNews(items);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [category, langParam]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-slate-500">Loading news...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-8 md:py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8 md:mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#102B4E] font-montserrat mb-3 md:mb-4">
            {category ? `${category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} News` : langParam ? `Rwanda News (${langParam})` : 'Rwanda News'}
          </h1>
          <p className="text-sm md:text-lg text-slate-500 font-medium">Stay updated with the latest happenings across Rwanda.</p>
        </div>

        {/* Category & Language Filters */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
          {NEWS_FILTERS.map((f) => {
            const isActive = (!category && !langParam && f.path === '/news') ||
              (langParam && f.path.includes(`lang=${langParam}`)) ||
              (category && f.path.endsWith(`/${category.toLowerCase()}`));
            return (
              <NavLink
                key={f.label}
                to={f.path}
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border",
                  isActive
                    ? "bg-[#083D91] text-white border-[#083D91] shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-teal-500 hover:text-teal-600"
                )}
              >
                {f.label}
              </NavLink>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {news.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl transition-all group"
            >
              <div className="aspect-[16/10] md:h-56 overflow-hidden relative">
                <img src={item.imageUrl} alt={item.headline} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-4 left-4">
                  <span className="bg-teal-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-widest shadow-lg shadow-teal-900/20">
                    {item.category}
                  </span>
                </div>
              </div>
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider mb-3">
                  <Calendar size={12} className="text-teal-500" />
                  {format(new Date(item.publishedAt), 'MMM dd, yyyy')}
                  <span className="opacity-30">|</span>
                  <span>{item.language}</span>
                </div>
                <h2 className="text-lg md:text-xl font-extrabold text-[#102B4E] mb-3 group-hover:text-teal-600 transition-colors line-clamp-2 leading-tight">
                  {item.headline}
                </h2>
                <p className="text-xs md:text-sm text-slate-500 mb-6 line-clamp-3 leading-relaxed opacity-80">
                  {item.summary}
                </p>
                <NavLink
                  to={`/news/${item.slug}`}
                  className="inline-flex items-center gap-2 text-teal-600 font-bold text-xs md:text-sm hover:gap-3 transition-all uppercase tracking-widest"
                >
                  Read full article <ArrowRight size={16} />
                </NavLink>
              </div>
            </motion.div>
          ))}
        </div>

        {news.length === 0 && (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <p className="text-slate-400 italic">No news articles found at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
