import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { collection, query, where, getDocs, limit, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NewsItem } from '../types';
import { Calendar, User, Clock, ChevronLeft, Share2, Printer, ArrowRight, MessageSquare } from 'lucide-react';
import { Facebook, Twitter, Linkedin, X } from '../components/ui/SocialIcons';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { cn } from '../lib/utils';

export function NewsDetailPage() {
  const { slug } = useParams();
  const [article, setArticle] = React.useState<NewsItem | null>(null);
  const [related, setRelated] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  const calculateReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const words = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scroll = `${totalScroll / windowHeight}`;
      setScrollProgress(Number(scroll) * 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'news'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const articleDoc = snap.docs[0];
          const data = { id: articleDoc.id, ...articleDoc.data() } as NewsItem;
          setArticle(data);
          
          // Increment views
          await updateDoc(doc(db, 'news', articleDoc.id), {
            views: increment(1)
          });

          // Log analytics
          await addDoc(collection(db, 'analytics'), {
            type: 'page_view',
            path: window.location.pathname,
            targetId: articleDoc.id,
            category: 'news',
            timestamp: new Date().toISOString()
          });
          
          // Fetch related
          const relQ = query(
            collection(db, 'news'), 
            where('status', '==', 'published'),
            where('category', '==', data.category), 
            limit(6)
          );
          const relSnap = await getDocs(relQ);
          setRelated(relSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)).filter(n => n.id !== data.id));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
    window.scrollTo(0, 0);
  }, [slug]);

  const shareUrl = window.location.href;

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <div className="animate-pulse space-y-8">
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="h-12 bg-slate-100 rounded w-3/4" />
        <div className="h-96 bg-slate-100 rounded-3xl" />
      </div>
    </div>
  );

  if (!article) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h2 className="text-3xl font-bold text-slate-900">Article Not Found</h2>
      <NavLink to="/news" className="bg-[#083D91] text-white px-8 py-3 rounded-xl font-bold mt-8 inline-block">Back to News</NavLink>
    </div>
  );

  return (
    <div className="bg-white min-h-screen relative pb-10">
      {/* Reading Progress Bar */}
      <div className="fixed top-[64px] md:top-[80px] left-0 w-full h-1 z-50 pointer-events-none">
        <div className="bg-teal-500 h-full transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 md:pt-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-[11px] md:text-xs font-bold text-slate-400 mb-6 overflow-hidden whitespace-nowrap scrollbar-hide">
          <NavLink to="/" className="hover:text-teal-600 shrink-0">Home</NavLink>
          <span className="opacity-30 shrink-0">/</span>
          <NavLink to="/news" className="hover:text-teal-600 shrink-0">News</NavLink>
          <span className="opacity-30 shrink-0">/</span>
          <NavLink to={`/news/${article.category.toLowerCase()}`} className="hover:text-teal-600 shrink-0">{article.category}</NavLink>
          <span className="opacity-30 shrink-0">/</span>
          <span className="text-slate-900 truncate">{article.headline}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Reading Column */}
          <article className="w-full lg:w-[70%]">
            <div className="space-y-6 mb-8 md:mb-12">
              <span className="inline-block bg-teal-500 text-white text-[10px] font-bold px-3 py-1 rounded-sm uppercase tracking-widest">
                {article.language === 'Kinyarwanda' ? 'Rwanda News (Kinyarwanda)' : article.category}
              </span>
              <h1 className="text-[27px] md:text-5xl lg:text-6xl font-extrabold text-[#102B4E] leading-[1.2] font-montserrat">
                {article.headline}
              </h1>
              {article.subtitle && (
                <p className="text-lg md:text-2xl text-slate-500 leading-relaxed font-inter font-medium italic border-l-4 border-teal-100 pl-4">
                  {article.subtitle}
                </p>
              )}

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-y border-slate-100 py-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-[#083D91] rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-xl flex-shrink-0">
                    {article.author[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#102B4E]">By {article.author}</p>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(article.publishedAt), 'MMM dd, yyyy')}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {calculateReadingTime(article.content)} min read</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Share:</span>
                  <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`)} className="p-2.5 rounded-full bg-blue-600 text-white hover:scale-110 transition-all shadow-lg shadow-blue-600/20">
                    <Facebook size={14} />
                  </button>
                  <button onClick={() => window.open(`https://twitter.com/intent/tweet?url=${shareUrl}`)} className="p-2.5 rounded-full bg-black text-white hover:scale-110 transition-all shadow-lg shadow-black/20">
                    <X size={14} />
                  </button>
                  <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${shareUrl}`)} className="p-2.5 rounded-full bg-emerald-500 text-white hover:scale-110 transition-all shadow-lg shadow-emerald-500/20">
                    <MessageSquare size={14} />
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied!'); }} className="p-2.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all">
                    <Share2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Image */}
            <div className="mb-10 md:mb-12">
              <div className="rounded-2xl md:rounded-[2rem] overflow-hidden shadow-2xl bg-slate-100 aspect-video">
                <img src={article.imageUrl} alt={article.headline} className="w-full h-full object-cover" />
              </div>
              {article.imageCaption && (
                <p className="text-center text-[11px] md:text-xs text-slate-400 mt-4 italic font-medium">
                  {article.imageCaption}
                </p>
              )}
            </div>

            {/* Content */}
            <div 
              className="prose prose-slate max-w-none 
                prose-headings:font-montserrat prose-headings:text-[#102B4E] prose-headings:font-extrabold
                prose-p:text-slate-700 prose-p:text-base md:prose-p:text-lg prose-p:leading-[1.7] md:prose-p:leading-[1.8]
                prose-a:text-teal-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-l-4 prose-blockquote:border-teal-500 prose-blockquote:bg-teal-50/50 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-xl prose-blockquote:italic prose-blockquote:text-lg md:prose-blockquote:text-xl
                prose-img:rounded-2xl md:prose-img:rounded-3xl prose-img:shadow-lg"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }}
            />

            {/* Footer Navigation */}
            <div className="mt-12 md:mt-20 pt-8 md:pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-between gap-6 md:gap-8">
               <NavLink to="/news" className="flex items-center gap-4 group flex-1">
                 <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#083D91] group-hover:text-white transition-all shrink-0">
                   <ChevronLeft size={20} />
                 </div>
                 <div className="flex flex-col min-w-0">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inyandiko ibanza</span>
                   <span className="text-sm font-bold text-[#102B4E] truncate">Inyandiko ibanza</span>
                 </div>
               </NavLink>
               
               <div className="hidden sm:block w-px h-10 bg-slate-100" />

               <NavLink to="/news" className="flex items-center justify-end gap-4 group flex-1 text-right">
                 <div className="flex flex-col min-w-0">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inyandiko ikurikira</span>
                   <span className="text-sm font-bold text-[#102B4E] truncate">Inyandiko ikurikira</span>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#083D91] group-hover:text-white transition-all shrink-0">
                   <ArrowRight size={20} />
                 </div>
               </NavLink>
            </div>
            
            <div className="mt-8 text-center">
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-[10px] font-bold text-teal-600 uppercase tracking-widest hover:underline">
                Scroll to Top ↑
              </button>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-[30%] space-y-12">
            <div className="bg-white p-6 md:p-8 rounded-2xl md:rounded-3xl border border-slate-100 shadow-xl shadow-blue-900/5 lg:sticky lg:top-24">
              <h3 className="text-lg md:text-xl font-extrabold text-[#102B4E] mb-8 font-montserrat">Andi Makuru Ashimishije</h3>
              <div className="space-y-6 md:space-y-8">
                {related.map(item => (
                  <NavLink key={item.id} to={`/news/${item.slug}`} className="flex gap-4 group">
                    <div className="w-20 h-16 md:w-24 md:h-20 rounded-lg md:rounded-xl overflow-hidden flex-shrink-0 bg-slate-100">
                      <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] md:text-sm font-bold text-[#102B4E] leading-tight group-hover:text-teal-600 transition-colors line-clamp-2">
                        {item.headline}
                      </h4>
                      <div className="flex items-center gap-2 mt-2 text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <Calendar size={10} /> {format(new Date(item.publishedAt), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  </NavLink>
                ))}
              </div>
              <NavLink to="/news" className="mt-10 w-full flex items-center justify-between bg-teal-50 text-teal-600 p-5 md:p-6 rounded-2xl group hover:bg-teal-600 hover:text-white transition-all">
                <div className="flex flex-col">
                  <span className="text-base md:text-lg font-extrabold font-montserrat leading-tight">Soma amakuru yose</span>
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-70">Reba izindi nkuru zose</span>
                </div>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-teal-600 text-white flex items-center justify-center group-hover:bg-white group-hover:text-teal-600 transition-all shadow-lg">
                  <ArrowRight size={18} />
                </div>
              </NavLink>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
