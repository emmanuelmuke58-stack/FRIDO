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
          setSidebarItems(sameCategory.slice(0, 6));
          setSidebarMode('related');
        } else {
          setSidebarItems(allPublished.filter((n) => n.id !== data.id).slice(0, 6));
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
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-10 pb-16">
          <div className="space-y-5 animate-pulse">
            <div className="h-3.5 bg-teal-100 rounded w-28" />
            <div className="h-9 sm:h-11 bg-slate-200 rounded w-full" />
            <div className="h-9 sm:h-11 bg-slate-200 rounded w-4/5" />
            <div className="h-[240px] sm:h-[380px] md:h-[460px] bg-slate-200 rounded-xl sm:rounded-2xl w-full" />
            <div className="flex items-center justify-between py-3 border-y border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="h-4 w-32 bg-slate-200 rounded" />
              </div>
              <div className="h-3.5 w-36 bg-slate-100 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="h-10 w-10 rounded-xl bg-slate-100" />
              <div className="h-10 w-24 rounded-xl bg-slate-100" />
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-11/12" />
              <div className="h-4 bg-slate-100 rounded w-full" />
              <div className="h-4 bg-slate-100 rounded w-4/5" />
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
            to="/news"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
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
    <div className="bg-white min-h-screen relative pb-14">
      {/* Reading Progress Bar aligned strictly below sticky header */}
      <div
        aria-hidden="true"
        className="fixed top-14 md:top-[74px] left-0 w-full h-[3px] z-40 pointer-events-none bg-transparent no-print"
      >
        <div
          className="bg-[#14B8A6] h-full transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Single-Column Reading Container */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 md:pt-8 lg:pt-10">
        {/* Desktop Breadcrumb Trail */}
        <nav
          aria-label="Breadcrumb"
          className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-500 mb-5 overflow-x-auto whitespace-nowrap scrollbar-hide"
        >
          <NavLink to="/" className="hover:text-[#083D91] transition-colors shrink-0">
            {t('nav.home')}
          </NavLink>
          <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
          <NavLink to="/news" className="hover:text-[#083D91] transition-colors shrink-0">
            {t('nav.news')}
          </NavLink>
          {article.category && (
            <>
              <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
              <NavLink
                to={`/news/category/${categorySlug}`}
                className="hover:text-[#083D91] transition-colors shrink-0"
              >
                {article.category}
              </NavLink>
            </>
          )}
          <span aria-hidden="true" className="text-slate-300 shrink-0">/</span>
          <span className="text-[#102B4E] font-bold truncate">{article.headline}</span>
        </nav>

        <article className="w-full min-w-0">
          {/* 1. Article Category */}
          {article.category && (
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#14B8A6] mb-2 sm:mb-3">
              <NavLink
                to={`/news/category/${categorySlug}`}
                className="hover:text-[#083D91] transition-colors"
              >
                {article.category}
              </NavLink>
              {article.featured && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-[#083D91]">{t('news.leadStory')}</span>
                </>
              )}
            </div>
          )}

          {/* 2. Article Title & Optional Subtitle */}
          <header className="mb-4 sm:mb-6">
            <h1 className="text-[22px] leading-[1.28] sm:text-[28px] sm:leading-[1.22] md:text-[34px] md:leading-[1.18] lg:text-[40px] lg:leading-[1.15] font-bold text-[#102B4E] tracking-tight break-words text-balance">
              {article.headline}
            </h1>
            {article.subtitle && (
              <p className="mt-2.5 sm:mt-3.5 text-[15px] sm:text-base md:text-lg text-slate-600 leading-relaxed font-normal">
                {article.subtitle}
              </p>
            )}
          </header>

          {/* 3. Featured Image (Full-width single column, preserves original aspect ratio) */}
          <figure className="mb-4 sm:mb-5 w-full">
            <button
              type="button"
              onClick={() => setZoomedImage(resolvedHeroImg)}
              className="w-full block rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200/80 bg-slate-100/80 relative group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
              aria-label="Expand article image"
            >
              <img
                src={resolvedHeroImg}
                alt={article.headline}
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[260px] min-[480px]:max-h-[340px] sm:max-h-[440px] md:max-h-[520px] lg:max-h-[600px] object-contain mx-auto block"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                }}
              />
              <span className="absolute bottom-3 right-3 bg-[#102B4E]/80 text-white p-2 rounded-xl opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Maximize2 size={16} />
              </span>
            </button>
            {article.imageCaption && (
              <figcaption className="text-xs sm:text-[13px] text-slate-500 mt-2.5 text-center leading-relaxed px-2">
                {article.imageCaption}
              </figcaption>
            )}
          </figure>

          {/* 4. Author Profile & Publication Date (Compact horizontal row below Featured Image) */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 sm:py-3.5 border-y border-slate-200/80 mb-4 sm:mb-5 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <AuthorAvatar
                src={article.authorAvatar}
                name={article.author}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs sm:text-sm shrink-0"
              />
              <span className="text-[13px] sm:text-sm font-bold text-[#102B4E] truncate">
                {t('news.by')} {article.author}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] sm:text-[13px] text-slate-500 font-medium tabular-nums">
              <time
                dateTime={article.publishedAt}
                className="inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Calendar size={12} className="text-[#14B8A6] shrink-0" aria-hidden="true" />
                {safeFormatDate(article.publishedAt, 'MMM d, yyyy · h:mm a')}
              </time>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Clock size={12} className="text-[#14B8A6] shrink-0" aria-hidden="true" />
                {readMins} {t('card.minRead')}
              </span>
              {(article.views || 0) > 0 && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline text-slate-300">·</span>
                  <span className="hidden sm:inline-flex items-center gap-1 whitespace-nowrap">
                    <Eye size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
                    {article.views.toLocaleString()} {t('news.views')}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 5. Social Sharing Buttons (Below Author Profile & Publication Date) */}
          <div
            className="flex flex-wrap items-center gap-2 pb-5 mb-6 sm:mb-8 border-b border-slate-100 no-print"
            role="group"
            aria-label={t('news.share')}
          >
            <span className="text-xs font-semibold text-slate-400 mr-1 hidden sm:inline">
              {t('news.share')}:
            </span>
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
                'h-10 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0',
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
              className="inline-flex h-10 w-10 rounded-xl bg-[#F1F5F9] hover:bg-slate-200 text-[#102B4E] items-center justify-center transition-colors cursor-pointer shrink-0 ml-auto"
            >
              <Printer size={15} />
            </button>
          </div>

          {/* 6. Article Content & Paragraphs (Full available single-column width) */}
          <div
            ref={proseContainerRef}
            className="article-prose w-full max-w-none overflow-x-hidden text-[15px] leading-[1.68] sm:text-[16px] sm:leading-[1.72] md:text-[17px] md:leading-[1.75]"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />

          {/* Optional Article Topics / Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 sm:mt-10 pt-5 sm:pt-6 border-t border-slate-200/80 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider">
                {t('news.topics')}:
              </span>
              {article.tags.map((tag) => (
                <NavLink
                  key={tag}
                  to={`/search?q=${encodeURIComponent(tag)}`}
                  className="font-semibold text-[#083D91] hover:text-[#14B8A6] transition-colors py-1"
                >
                  #{tag}
                </NavLink>
              ))}
            </div>
          )}

          {/* Previous & Next Article Navigation */}
          {(prevArticle || nextArticle) && (
            <nav
              aria-label="Adjacent articles"
              className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 no-print"
            >
              {prevArticle ? (
                <NavLink
                  to={`/news/${prevArticle.slug}`}
                  className="flex items-center gap-3.5 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#14B8A6] transition-colors group min-w-0"
                >
                  <img
                    src={resolveAssetUrl(prevArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-200"
                    onError={(e) => {
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
                <div className="hidden sm:block" />
              )}

              {nextArticle ? (
                <NavLink
                  to={`/news/${nextArticle.slug}`}
                  className="flex items-center justify-between gap-3.5 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-[#14B8A6] transition-colors group min-w-0 sm:text-right"
                >
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
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-200 order-1 sm:order-2"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                    }}
                  />
                </NavLink>
              ) : (
                <div className="hidden sm:block" />
              )}
            </nav>
          )}

          <div className="mt-6 pt-4 flex items-center justify-between gap-4 no-print">
            <NavLink
              to="/news"
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-[#083D91] hover:text-[#14B8A6] transition-colors"
            >
              <ChevronLeft size={16} />
              <span>{t('news.backToNews')}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#083D91] transition-colors cursor-pointer"
            >
              <span>{t('news.scrollTop')}</span>
              <ArrowUp size={15} />
            </button>
          </div>
        </article>

        {/* 7. Related Articles Section (Stacked cleanly below article in single column) */}
        <section
          aria-label={sidebarMode === 'related' ? t('news.relatedTitle') : t('news.latestTitle')}
          className="mt-10 sm:mt-12 pt-8 border-t border-slate-200 space-y-6 no-print"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#102B4E]">
              {sidebarMode === 'related' ? t('news.relatedTitle') : t('news.latestTitle')}
            </h2>
            <NavLink
              to="/news"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#083D91] hover:text-[#14B8A6] transition-colors"
            >
              <span>{t('section.news.cta')}</span>
              <ArrowRight size={15} />
            </NavLink>
          </div>

          {sidebarItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {sidebarItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={`/news/${item.slug}`}
                  className="bg-[#F8FAFC] rounded-xl border border-slate-200/80 hover:border-[#083D91]/35 hover:shadow-sm overflow-hidden flex flex-col group transition-all"
                >
                  <div className="aspect-[16/10] bg-slate-200 overflow-hidden shrink-0">
                    <img
                      src={resolveAssetUrl(item.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                      alt={item.headline}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                      }}
                    />
                  </div>
                  <div className="p-4 flex flex-col flex-1 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] mb-1 truncate">
                      {item.category}
                    </span>
                    <h3 className="text-[15px] font-bold text-[#102B4E] group-hover:text-[#083D91] transition-colors leading-snug break-words">
                      {item.headline}
                    </h3>
                    <span className="mt-auto pt-2.5 text-xs text-slate-500 font-medium tabular-nums">
                      {safeFormatDate(item.publishedAt, 'MMM d, yyyy')}
                    </span>
                  </div>
                </NavLink>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('news.emptyAll')}</p>
          )}

          {/* Explore Other Platform Opportunities */}
          <div className="bg-[#F8FAFC] rounded-2xl border border-slate-200/80 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#102B4E]">{t('nav.opportunities')}</span>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <NavLink
                  to="/jobs"
                  className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 hover:border-[#14B8A6] text-xs sm:text-sm font-bold text-[#102B4E] transition-colors"
                >
                  <Briefcase size={15} className="text-[#083D91]" />
                  <span>{t('nav.jobs')}</span>
                </NavLink>
                <NavLink
                  to="/scholarships"
                  className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 hover:border-[#14B8A6] text-xs sm:text-sm font-bold text-[#102B4E] transition-colors"
                >
                  <GraduationCap size={15} className="text-[#14B8A6]" />
                  <span>{t('nav.scholarships')}</span>
                </NavLink>
                <NavLink
                  to="/tenders"
                  className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 hover:border-[#14B8A6] text-xs sm:text-sm font-bold text-[#102B4E] transition-colors"
                >
                  <FileText size={15} className="text-[#083D91]" />
                  <span>{t('nav.tenders')}</span>
                </NavLink>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Accessible Image Zoom Lightbox */}
      {zoomedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded article image"
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
          >
            <CloseIcon size={22} />
          </button>
          <img
            src={zoomedImage}
            alt={article.headline}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-2xl object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
}
