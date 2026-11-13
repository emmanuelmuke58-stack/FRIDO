import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, increment, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { NewsItem } from '../types';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ArrowRight,
  MessageSquare,
  Maximize2,
  X as CloseIcon,
  Link2,
  Check,
  Printer,
  ArrowUp,
  Eye,
  Briefcase,
  GraduationCap,
  FileText,
} from 'lucide-react';
import { Facebook, X } from '../components/ui/SocialIcons';
import DOMPurify from 'dompurify';
import { cn, safeFormatDate } from '../lib/utils';
import {
  isNewsPubliclyVisible,
  calculateReadingTime,
  PUBLIC_DATA_UPDATED_EVENT,
} from '../lib/publicData';
import { STATIC_ASSETS, resolveAssetUrl } from '../lib/assets';
import { useLanguage } from '../lib/LanguageContext';
import { useSettings } from '../lib/SettingsContext';

function AuthorAvatar({
  src,
  name,
  className,
}: {
  src?: string;
  name?: string;
  className: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'Author'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn(className, 'object-cover border border-slate-200')}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        className,
        'bg-[#083D91] text-white font-bold flex items-center justify-center'
      )}
    >
      {(name || 'R').charAt(0).toUpperCase()}
    </div>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams();
  const { t } = useLanguage();
  const { settings } = useSettings();

  const [article, setArticle] = React.useState<NewsItem | null>(null);
  const [sidebarItems, setSidebarItems] = React.useState<NewsItem[]>([]);
  const [sidebarMode, setSidebarMode] = React.useState<'related'| 'latest'>('related');
  const [prevArticle, setPrevArticle] = React.useState<NewsItem | null>(null);
  const [nextArticle, setNextArticle] = React.useState<NewsItem | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const proseContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      const windowHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (windowHeight > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (totalScroll / windowHeight) * 100)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchArticle = React.useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const q = query(collection(db, 'news'), where('status', '==', 'published'));
      const snap = await getDocs(q);
      const allPublished = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as NewsItem))
        .filter((n) => isNewsPubliclyVisible(n, now))
        .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

      const data = allPublished.find((n) => n.slug === slug) || null;
      if (data) {
        setArticle(data);

        // Increment views safely
        updateDoc(doc(db, 'news', data.id), {
          views: increment(1),
        }).catch((err) => console.warn('View increment skipped:', err));

        // Log analytics
        addDoc(collection(db, 'analytics'), {
          type: 'page_view',
          path: window.location.pathname,
          targetId: data.id,
          category: 'news',
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        const sameCategory = allPublished.filter(
          (n) => n.id !== data.id && (n.category || '').toLowerCase() === (data.category || '').toLowerCase()
        );

        if (sameCategory.length > 0) {
          setSidebarItems(sameCategory.slice(0, 5));
          setSidebarMode('related');
        } else {
          setSidebarItems(allPublished.filter((n) => n.id !== data.id).slice(0, 5));
          setSidebarMode('latest');
        }

        const idx = allPublished.findIndex((n) => n.id === data.id);
        if (idx !== -1) {
          setNextArticle(idx > 0 ? allPublished[idx - 1] : null);
          setPrevArticle(idx < allPublished.length - 1 ? allPublished[idx + 1] : null);
        }
      } else {
        setArticle(null);
        setSidebarItems([]);
        setNextArticle(null);
        setPrevArticle(null);
      }
    } catch (e) {
      console.error('Error loading article:', e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => {
    fetchArticle();
    window.scrollTo(0, 0);
  }, [fetchArticle]);

  React.useEffect(() => {
    const onUpdate = () => fetchArticle();
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
  }, [fetchArticle]);

  // Dynamic SEO title & meta description per article
  React.useEffect(() => {
    if (!article) return;
    const prevTitle = document.title;
    const targetTitle = article.seoTitle?.trim() || `${article.headline} | ${settings.websiteName}`;
    document.title = targetTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') || '';
    const nextDesc = article.seoDescription?.trim() || article.summary || settings.seo.defaultDescription;
    if (metaDesc && nextDesc) {
      metaDesc.setAttribute('content', nextDesc);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) {
        metaDesc.setAttribute('content', prevDesc);
      }
    };
  }, [article, settings.websiteName, settings.seo.defaultDescription]);

  // Ensure inline images inside rich-text body apply no-referrer and never break
  React.useEffect(() => {
    if (!proseContainerRef.current || !article) return;
    const imgs = proseContainerRef.current.querySelectorAll('img');
    imgs.forEach((img) => {
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('loading', 'lazy');
      img.onerror = () => {
        if (img.src !== STATIC_ASSETS.rwandaNewsKagame) {
          img.src = STATIC_ASSETS.rwandaNewsKagame;
        }
      };
    });
  }, [article]);

  // Close lightbox on Escape
  React.useEffect(() => {
    if (!zoomedImage) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedImage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomedImage]);

  const sanitizedHtml = React.useMemo(() => {
    if (!article?.content) return '';
    return DOMPurify.sanitize(article.content, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
    });
  }, [article?.content]);

  const shareUrl = typeof window !== 'undefined'? window.location.href : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback if clipboard API blocked
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 md:pt-12 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-3.5 bg-slate-200 rounded w-56"/>
              <div className="h-4 bg-teal-100 rounded w-36"/>
              <div className="h-12 bg-slate-200 rounded w-full"/>
              <div className="h-12 bg-slate-200 rounded w-4/5"/>
              <div className="h-20 bg-slate-100 rounded-xl w-full"/>
              <div className="aspect-[16/9] bg-slate-200 rounded-2xl w-full"/>
              <div className="space-y-3 pt-4">
                <div className="h-4 bg-slate-100 rounded w-full"/>
                <div className="h-4 bg-slate-100 rounded w-11/12"/>
                <div className="h-4 bg-slate-100 rounded w-4/5"/>
              </div>
            </div>
            <div className="lg:col-span-4 space-y-4">
              <div className="h-80 bg-slate-100 rounded-2xl"/>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="bg-[#F8FAFC] min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xs">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E] mb-3">
            {t('news.notFoundTitle')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mb-6">{t('news.notFoundDesc')}</p>
          <NavLink
            to="/news" className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
            <ChevronLeft size={16} />
            <span>{t('news.backToNews')}</span>
          </NavLink>
        </div>
      </div>
    );
  }

  const readMins = calculateReadingTime(article.content);
  const resolvedHeroImg = resolveAssetUrl(article.imageUrl, STATIC_ASSETS.rwandaNewsKagame);
  const categorySlug = (article.category || 'news').toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="bg-white min-h-screen relative pb-12">
      {/* Reading Progress Bar aligned strictly below sticky header */}
      <div
        aria-hidden="true" className="fixed top-14 md:top-[74px] left-0 w-full h-[3px] z-40 pointer-events-none bg-transparent no-print">
        <div
          className="bg-[#14B8A6] h-full transition-all duration-150 ease-out" style={{ width: `${scrollProgress}%` }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 md:pt-6 lg:pt-10">
        {/* 1. Breadcrumbs (Desktop Only) */}
        <nav
          aria-label="Breadcrumb"
          className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 mb-7 overflow-x-auto whitespace-nowrap scrollbar-hide"
        >
          <NavLink to="/" className="hover:text-[#083D91] transition-colors shrink-0">
            {t('nav.home')}
          </NavLink>
          <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
          <NavLink to="/news" className="hover:text-[#083D91] transition-colors shrink-0">
            {t('nav.news')}
          </NavLink>
          <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
          <NavLink
            to={`/news/category/${categorySlug}`}
            className="hover:text-[#083D91] transition-colors shrink-0"
          >
            {article.category}
          </NavLink>
          <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
          <span className="text-[#102B4E] font-bold truncate">{article.headline}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Main Reading Column */}
          <article className="lg:col-span-8 min-w-0">
            {/* Article Header */}
            <header className="mb-5 md:mb-6 lg:mb-9">
              {/* Unboxed Category Kicker (Desktop Only) */}
              <div className="hidden lg:flex flex-wrap items-center gap-2 text-sm font-bold text-[#14B8A6] mb-4">
                <NavLink
                  to={`/news/category/${categorySlug}`}
                  className="hover:text-[#083D91] transition-colors"
                >
                  {article.category}
                </NavLink>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="text-slate-500 font-semibold">{article.language}</span>
                {article.featured && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="text-[#083D91] font-bold">{t('news.leadStory')}</span>
                  </>
                )}
              </div>

              {/* Article Headline */}
              <h1 className="text-[25px] sm:text-[28px] md:text-[32px] lg:text-[42px] font-bold text-[#102B4E] leading-[1.24] md:leading-[1.2] lg:leading-[1.18] tracking-tight break-words text-balance">
                {article.headline}
              </h1>

              {/* Subtitle / Lead Deck */}
              {article.subtitle && (
                <p className="mt-2.5 lg:mt-4 text-[15px] sm:text-base md:text-lg lg:text-xl text-slate-600 leading-relaxed font-normal max-w-3xl">
                  {article.subtitle}
                </p>
              )}

              {/* Mobile & Tablet (< lg): Compact Single-Line Author + Date, followed by Share Bar */}
              <div className="lg:hidden mt-4">
                <div className="flex items-center justify-between gap-2.5 py-2.5 border-y border-slate-200/80 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <AuthorAvatar
                      src={article.authorAvatar}
                      name={article.author}
                      className="w-7 h-7 rounded-full text-[11px] shrink-0"
                    />
                    <span className="text-[13px] font-semibold text-[#102B4E] truncate min-w-0">
                      {article.author}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[12px] text-slate-500 font-medium tabular-nums whitespace-nowrap shrink-0">
                    <span>{safeFormatDate(article.publishedAt, 'MMM d, yyyy')}</span>
                    <span aria-hidden="true" className="text-slate-300">·</span>
                    <span className="sm:hidden">{readMins} min</span>
                    <span className="hidden sm:inline">{readMins} {t('card.minRead')}</span>
                  </div>
                </div>

                {/* Mobile & Tablet Share Row Below Author Line */}
                <div
                  className="flex items-center gap-2 pt-3 no-print"
                  role="group"
                  aria-label={t('news.share')}
                >
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Facebook"
                    className="h-10 w-10 rounded-xl bg-[#F1F5F9] hover:bg-[#1877F2] text-[#102B4E] hover:text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <Facebook size={15} />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.headline)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className="h-10 w-10 rounded-xl bg-[#F1F5F9] hover:bg-black text-[#102B4E] hover:text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <X size={15} />
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${article.headline} — ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="h-10 w-10 rounded-xl bg-[#F1F5F9] hover:bg-[#16A34A] text-[#102B4E] hover:text-white flex items-center justify-center transition-colors shrink-0"
                  >
                    <MessageSquare size={15} />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label={t('news.copyLink')}
                    className={cn(
                      'h-10 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0',
                      copied
                        ? 'bg-[#14B8A6] text-white'
                        : 'bg-[#F1F5F9] hover:bg-[#083D91] text-[#102B4E] hover:text-white'
                    )}
                  >
                    {copied ? <Check size={14} /> : <Link2 size={14} />}
                    <span>{copied ? t('news.copied') : t('news.copyLink')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    aria-label={t('news.print')}
                    className="hidden md:inline-flex h-10 w-10 rounded-xl bg-[#F1F5F9] hover:bg-slate-200 text-[#102B4E] items-center justify-center transition-colors cursor-pointer shrink-0 ml-auto"
                  >
                    <Printer size={15} />
                  </button>
                </div>
              </div>

              {/* Desktop (lg+): Preserved Side-by-Side Author Metadata + Share Bar */}
              <div className="hidden lg:flex items-center justify-between gap-4 border-y border-slate-200/80 py-5 mt-5">
                <div className="flex items-center gap-3.5 min-w-0">
                  <AuthorAvatar
                    src={article.authorAvatar}
                    name={article.author}
                    className="w-11 h-11 rounded-full text-sm shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#102B4E] truncate">
                      {t('news.by')} {article.author}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 font-medium tabular-nums mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-[#14B8A6]" />
                        {safeFormatDate(article.publishedAt, 'MMM dd, yyyy')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-[#14B8A6]" />
                        {readMins} {t('card.minRead')}
                      </span>
                      {(article.views || 0) > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Eye size={12} className="text-slate-400" />
                            {article.views.toLocaleString()} {t('news.views')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Desktop Interactive Share Controls */}
                <div className="flex items-center gap-2 no-print" role="group" aria-label={t('news.share')}>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Facebook"
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-[#F1F5F9] hover:bg-[#1877F2] text-[#102B4E] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <Facebook size={16} />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.headline)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-[#F1F5F9] hover:bg-black text-[#102B4E] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <X size={16} />
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${article.headline} — ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="min-h-[42px] min-w-[42px] rounded-xl bg-[#F1F5F9] hover:bg-[#16A34A] text-[#102B4E] hover:text-white flex items-center justify-center transition-colors"
                  >
                    <MessageSquare size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    aria-label={t('news.copyLink')}
                    className={cn(
                      'min-h-[42px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                      copied
                        ? 'bg-[#14B8A6] text-white'
                        : 'bg-[#F1F5F9] hover:bg-[#083D91] text-[#102B4E] hover:text-white'
                    )}
                  >
                    {copied ? <Check size={15} /> : <Link2 size={15} />}
                    <span>{copied ? t('news.copied') : t('news.copyLink')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    aria-label={t('news.print')}
                    className="inline-flex min-h-[42px] min-w-[42px] rounded-xl bg-[#F1F5F9] hover:bg-slate-200 text-[#102B4E] items-center justify-center transition-colors cursor-pointer"
                  >
                    <Printer size={16} />
                  </button>
                </div>
              </div>
            </header>

            {/* Main Featured Image + Caption */}
            <figure className="mb-6 md:mb-8 lg:mb-10">
              <button
                type="button"
                onClick={() => setZoomedImage(resolvedHeroImg)}
                className="w-full block rounded-xl md:rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100 aspect-[16/9] relative group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                aria-label="Expand article image"
              >
                <img
                  src={resolvedHeroImg}
                  alt={article.headline}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                  }}
                />
                <span className="absolute bottom-3 right-3 bg-[#102B4E]/80 text-white p-2 rounded-xl opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Maximize2 size={16} />
                </span>
              </button>
              {article.imageCaption && (
                <figcaption className="text-xs sm:text-sm text-slate-500 mt-2.5 lg:mt-3 text-center leading-relaxed px-2">
                  {article.imageCaption}
                </figcaption>
              )}
            </figure>

            {/* 8. Complete Rich-Text Article Body */}
            <div
              ref={proseContainerRef}
              className="article-prose max-w-[68ch] overflow-x-hidden"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />

            {/* Optional Article Topics / Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-10 pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider">
                  {t('news.topics')}:
                </span>
                {article.tags.map((tag) => (
                  <NavLink
                    key={tag}
                    to={`/search?q=${encodeURIComponent(tag)}`}
                    className="font-semibold text-[#083D91] hover:text-[#14B8A6] transition-colors py-1">
                    #{tag}
                  </NavLink>
                ))}
              </div>
            )}

            {/* 9. Previous & Next Article Navigation */}
            {(prevArticle || nextArticle) && (
              <nav
                aria-label="Adjacent articles" className="mt-10 md:mt-14 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 no-print">
                {prevArticle ? (
                  <NavLink
                    to={`/news/${prevArticle.slug}`}
                    className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#14B8A6] transition-colors group min-w-0">
                    <img
                      src={resolveAssetUrl(prevArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                      alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-200" onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14B8A6]">
                        <ChevronLeft size={13} />
                        {t('news.prevArticle')}
                      </span>
                      <p className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] line-clamp-2 leading-snug mt-0.5">
                        {prevArticle.headline}
                      </p>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {safeFormatDate(prevArticle.publishedAt, 'MMM dd, yyyy')}
                      </span>
                    </div>
                  </NavLink>
                ) : (
                  <div className="hidden sm:block"/>
                )}

                {nextArticle ? (
                  <NavLink
                    to={`/news/${nextArticle.slug}`}
                    className="flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#14B8A6] transition-colors group min-w-0 sm:text-right">
                    <div className="min-w-0 flex-1 order-2 sm:order-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14B8A6]">
                        {t('news.nextArticle')}
                        <ArrowRight size={13} />
                      </span>
                      <p className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] line-clamp-2 leading-snug mt-0.5">
                        {nextArticle.headline}
                      </p>
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        {safeFormatDate(nextArticle.publishedAt, 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <img
                      src={resolveAssetUrl(nextArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                      alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-200 order-1 sm:order-2" onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                      }}
                    />
                  </NavLink>
                ) : (
                  <div className="hidden sm:block"/>
                )}
              </nav>
            )}

            <div className="mt-6 pt-4 flex items-center justify-between gap-4 no-print">
              <NavLink
                to="/news" className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-[#083D91] hover:text-[#14B8A6] transition-colors">
                <ChevronLeft size={16} />
                <span>{t('news.backToNews')}</span>
              </NavLink>
              <button
                type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth'})}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#083D91] transition-colors cursor-pointer">
                <span>{t('news.scrollTop')}</span>
                <ArrowUp size={15} />
              </button>
            </div>
          </article>

          {/* 10. Editorial Sidebar (Sticky on Desktop, Stacked cleanly on Mobile) */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 no-print">
            {/* Related or Latest News Panel */}
            <div className="bg-[#F8FAFC] rounded-2xl border border-slate-200/80 p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
                <h2 className="text-lg font-bold text-[#102B4E]">
                  {sidebarMode === 'related'? t('news.relatedTitle') : t('news.latestTitle')}
                </h2>
              </div>

              {sidebarItems.length > 0 ? (
                <div className="divide-y divide-slate-200/70">
                  {sidebarItems.map((item) => (
                    <NavLink
                      key={item.id}
                      to={`/news/${item.slug}`}
                      className="flex gap-3.5 py-3.5 first:pt-0 last:pb-0 group">
                      <div className="w-20 h-16 rounded-xl overflow-hidden shrink-0 bg-slate-200">
                        <img
                          src={resolveAssetUrl(item.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                          alt={item.headline}
                          loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-[#14B8A6] mb-1 truncate">
                          {item.category} · {safeFormatDate(item.publishedAt, 'MMM dd')}
                        </div>
                        <h3 className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] transition-colors line-clamp-2 leading-snug">
                          {item.headline}
                        </h3>
                      </div>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-2">{t('news.emptyAll')}</p>
              )}

              <NavLink
                to="/news" className="mt-5 min-h-[44px] w-full flex items-center justify-between bg-[#083D91] hover:bg-[#07366D] text-white px-4 py-3 rounded-xl transition-colors group">
                <div className="min-w-0">
                  <span className="text-sm font-bold block leading-tight">{t('news.readAllTitle')}</span>
                  <span className="text-[11px] text-white/80 block truncate mt-0.5">
                    {t('news.readAllDesc')}
                  </span>
                </div>
                <ArrowRight size={18} className="shrink-0 group-hover:translate-x-0.5 transition-transform"/>
              </NavLink>
            </div>

            {/* Direct Opportunity Discovery Links */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6">
              <h2 className="text-base font-bold text-[#102B4E] pb-3 mb-3 border-b border-slate-100">
                {t('nav.opportunities')}
              </h2>
              <div className="grid grid-cols-1 gap-2">
                <NavLink
                  to="/jobs" className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-bold text-[#102B4E] transition-colors">
                  <span className="inline-flex items-center gap-2.5">
                    <Briefcase size={16} className="text-[#083D91]"/>
                    {t('nav.jobs')}
                  </span>
                  <ArrowRight size={15} className="text-slate-400"/>
                </NavLink>
                <NavLink
                  to="/scholarships" className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-bold text-[#102B4E] transition-colors">
                  <span className="inline-flex items-center gap-2.5">
                    <GraduationCap size={16} className="text-[#14B8A6]"/>
                    {t('nav.scholarships')}
                  </span>
                  <ArrowRight size={15} className="text-slate-400"/>
                </NavLink>
                <NavLink
                  to="/tenders" className="min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] text-sm font-bold text-[#102B4E] transition-colors">
                  <span className="inline-flex items-center gap-2.5">
                    <FileText size={16} className="text-[#083D91]"/>
                    {t('nav.tenders')}
                  </span>
                  <ArrowRight size={15} className="text-slate-400"/>
                </NavLink>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Accessible Image Zoom Lightbox */}
      {zoomedImage && (
        <div
          role="dialog" aria-modal="true" aria-label="Expanded article image" onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out">
          <button
            type="button" onClick={() => setZoomedImage(null)}
            aria-label="Close image preview" className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer">
            <CloseIcon size={22} />
          </button>
          <img
            src={zoomedImage}
            alt={article.headline}
            referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain cursor-default"/>
        </div>
      )}
    </div>
  );
}
