import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
  addDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ArticleAdBanner, ArticleComment, NewsItem } from '../types';
import {
  Clock,
  ChevronLeft,
  ArrowRight,
  MessageSquare,
  X as CloseIcon,
  Link2,
  Check,
  Printer,
  ArrowUp,
  Send,
} from 'lucide-react';
import { Facebook, X, Linkedin, WhatsApp, Pinterest } from '../components/ui/SocialIcons';
import DOMPurify from 'dompurify';
import { cn, safeFormatDate } from '../lib/utils';
import {
  isNewsPubliclyVisible,
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

function SidebarAdItem({ ad }: { ad: ArticleAdBanner }) {
  const label = ad.label?.trim() || 'Kwamamaza';
  const trimmedLink = (ad.linkUrl || '').trim();
  const isInternal = trimmedLink.startsWith('/');

  const imageElement = (
    <img
      src={ad.imageUrl}
      alt={ad.title || label}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="w-full h-auto object-contain block"
    />
  );

  return (
    <div className="w-full">
      <div className="text-[11px] font-medium text-slate-400 text-center mb-1.5 select-none">
        {label}
      </div>
      <div className="border border-slate-200 bg-white p-1.5 transition-colors hover:border-slate-300">
        {trimmedLink ? (
          isInternal ? (
            <NavLink
              to={trimmedLink}
              aria-label={ad.title || label}
              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#083D91]"
            >
              {imageElement}
            </NavLink>
          ) : (
            <a
              href={trimmedLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ad.title || label}
              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#083D91]"
            >
              {imageElement}
            </a>
          )
        ) : (
          imageElement
        )}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams();
  const { t, language } = useLanguage();
  const { settings } = useSettings();

  const [article, setArticle] = React.useState<NewsItem | null>(null);
  const [relatedItems, setRelatedItems] = React.useState<NewsItem[]>([]);
  const [relatedMode, setRelatedMode] = React.useState<'related' | 'latest'>('related');
  const [prevArticle, setPrevArticle] = React.useState<NewsItem | null>(null);
  const [nextArticle, setNextArticle] = React.useState<NewsItem | null>(null);
  const [comments, setComments] = React.useState<ArticleComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [zoomedImage, setZoomedImage] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Comment form state
  const [commentAuthor, setCommentAuthor] = React.useState('');
  const [commentText, setCommentText] = React.useState('');
  const [commentSubmitting, setCommentSubmitting] = React.useState(false);
  const [commentStatus, setCommentStatus] = React.useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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

  const fetchComments = React.useCallback(async (articleId: string) => {
    try {
      const cq = query(
        collection(db, 'comments'),
        where('articleId', '==', articleId),
        where('status', '==', 'approved')
      );
      const cSnap = await getDocs(cq);
      const list = cSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ArticleComment))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setComments(list);
    } catch (err) {
      console.warn('Unable to load comments:', err);
      setComments([]);
    }
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
        fetchComments(data.id);

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

        // Build related articles: prioritize admin-curated relatedArticleIds, then same category, then latest
        const others = allPublished.filter((n) => n.id !== data.id);
        const curatedMap = new Map(others.map((o) => [o.id, o]));
        const curated = (data.relatedArticleIds || [])
          .map((rid) => curatedMap.get(rid))
          .filter((item): item is NewsItem => Boolean(item));
        const curatedIds = new Set(curated.map((c) => c.id));

        const sameCategory = others.filter(
          (n) =>
            !curatedIds.has(n.id) &&
            (n.category || '').toLowerCase() === (data.category || '').toLowerCase()
        );

        const combinedRelated = [...curated, ...sameCategory];
        if (combinedRelated.length > 0) {
          setRelatedItems(combinedRelated.slice(0, 6));
          setRelatedMode('related');
        } else {
          setRelatedItems(others.slice(0, 6));
          setRelatedMode('latest');
        }

        const idx = allPublished.findIndex((n) => n.id === data.id);
        if (idx !== -1) {
          setNextArticle(idx > 0 ? allPublished[idx - 1] : null);
          setPrevArticle(idx < allPublished.length - 1 ? allPublished[idx + 1] : null);
        }
      } else {
        setArticle(null);
        setComments([]);
        setRelatedItems([]);
        setNextArticle(null);
        setPrevArticle(null);
      }
    } catch (e) {
      console.error('Error loading article:', e);
    } finally {
      setLoading(false);
    }
  }, [slug, fetchComments]);

  React.useEffect(() => {
    fetchArticle();
    window.scrollTo(0, 0);
  }, [fetchArticle]);

  React.useEffect(() => {
    const onUpdate = () => fetchArticle();
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
  }, [fetchArticle]);

  // Dynamic SEO metadata & Schema.org NewsArticle JSON-LD
  React.useEffect(() => {
    if (!article) return;

    const prevTitle = document.title;
    const targetTitle = article.seoTitle?.trim() || `${article.headline} | ${settings.websiteName}`;
    document.title = targetTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') || '';
    const nextDesc =
      article.seoDescription?.trim() ||
      article.summary?.trim() ||
      article.subtitle?.trim() ||
      settings.seo.defaultDescription;
    if (metaDesc && nextDesc) {
      metaDesc.setAttribute('content', nextDesc);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const prevOgTitle = ogTitle?.getAttribute('content') || '';
    if (ogTitle) ogTitle.setAttribute('content', targetTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    const prevOgDesc = ogDesc?.getAttribute('content') || '';
    if (ogDesc && nextDesc) ogDesc.setAttribute('content', nextDesc);

    const resolvedImg = resolveAssetUrl(article.imageUrl, STATIC_ASSETS.rwandaNewsKagame);
    const jsonLdScript = document.createElement('script');
    jsonLdScript.id = 'article-news-jsonld';
    jsonLdScript.type = 'application/ld+json';
    jsonLdScript.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: article.headline,
      description: nextDesc,
      image: [resolvedImg],
      datePublished: article.publishedAt,
      dateModified: article.publishedAt,
      articleSection: article.category || 'News',
      author: {
        '@type': 'Person',
        name: article.author || settings.websiteName,
      },
      publisher: {
        '@type': 'Organization',
        name: settings.websiteName,
        ...(settings.logoUrl
          ? {
              logo: {
                '@type': 'ImageObject',
                url: settings.logoUrl,
              },
            }
          : {}),
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': window.location.href,
      },
    });
    document.head.appendChild(jsonLdScript);

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) metaDesc.setAttribute('content', prevDesc);
      if (ogTitle && prevOgTitle) ogTitle.setAttribute('content', prevOgTitle);
      if (ogDesc && prevOgDesc) ogDesc.setAttribute('content', prevOgDesc);
      document.getElementById('article-news-jsonld')?.remove();
    };
  }, [article, settings.websiteName, settings.seo.defaultDescription, settings.logoUrl]);

  // Ensure inline images inside rich-text body never break, support click-to-zoom, and stay responsive
  React.useEffect(() => {
    if (!proseContainerRef.current || !article) return;
    const imgs = proseContainerRef.current.querySelectorAll('img');
    const cleanups: (() => void)[] = [];

    imgs.forEach((img) => {
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('loading', 'lazy');
      img.style.cursor = 'zoom-in';
      img.onerror = () => {
        if (img.src !== STATIC_ASSETS.rwandaNewsKagame) {
          img.src = STATIC_ASSETS.rwandaNewsKagame;
        }
      };
      const onImgClick = () => {
        setZoomedImage(img.currentSrc || img.src);
      };
      img.addEventListener('click', onImgClick);
      cleanups.push(() => img.removeEventListener('click', onImgClick));
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
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

  const activeSidebarAds = React.useMemo(() => {
    return (settings.articleSidebarAds || [])
      .filter((ad) => ad.enabled !== false && Boolean((ad.imageUrl || '').trim()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [settings.articleSidebarAds]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback if clipboard API blocked
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!article) return;

    const cleanName = commentAuthor.trim();
    const cleanContent = commentText.trim();

    if (cleanName.length < 1 || cleanName.length > 80) {
      setCommentStatus({
        type: 'error',
        message:
          language === 'Kinyarwanda'
            ? 'Andika izina ryawe (hagati y’inyuguti 1 na 80).'
            : 'Please enter your name (1 to 80 characters).',
      });
      return;
    }

    if (cleanContent.length < 2 || cleanContent.length > 2000) {
      setCommentStatus({
        type: 'error',
        message:
          language === 'Kinyarwanda'
            ? 'Igitekerezo kigomba kugira nibura inyuguti 2.'
            : 'Please write a comment (2 to 2,000 characters).',
      });
      return;
    }

    setCommentSubmitting(true);
    setCommentStatus(null);
    const createdAt = new Date().toISOString();

    try {
      const payload = {
        articleId: article.id,
        authorName: cleanName,
        content: cleanContent,
        status: 'approved' as const,
        createdAt,
      };
      const docRef = await addDoc(collection(db, 'comments'), payload);
      setComments((prev) => [{ id: docRef.id, ...payload }, ...prev]);
      setCommentAuthor('');
      setCommentText('');
      setCommentStatus({
        type: 'success',
        message:
          language === 'Kinyarwanda'
            ? 'Igitekerezo cyawe cyoherejwe neza.'
            : 'Your comment has been published.',
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, 'comments');
      } catch {
        setCommentStatus({
          type: 'error',
          message:
            language === 'Kinyarwanda'
              ? 'Ntibyakunze kohereza igitekerezo. Ongera ugerageze.'
              : 'Failed to submit comment. Please try again.',
        });
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-8 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[82fr_18fr] gap-6 lg:gap-8 animate-pulse">
            <div className="space-y-5">
              <div className="h-3.5 w-48 bg-slate-100 rounded" />
              <div className="h-9 bg-slate-200 rounded w-full" />
              <div className="h-9 bg-slate-200 rounded w-3/4" />
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="h-4 w-48 bg-slate-200 rounded" />
                </div>
                <div className="h-4 w-10 bg-slate-100 rounded" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[43fr_57fr] gap-6 pt-2">
                <div className="aspect-[16/10] bg-slate-200 rounded-[4px]" />
                <div className="space-y-4">
                  <div className="flex md:justify-end gap-2">
                    <div className="w-9 h-9 bg-slate-200 rounded-[4px]" />
                    <div className="w-9 h-9 bg-slate-200 rounded-[4px]" />
                    <div className="w-9 h-9 bg-slate-200 rounded-[4px]" />
                    <div className="w-9 h-9 bg-slate-200 rounded-[4px]" />
                    <div className="w-9 h-9 bg-slate-200 rounded-[4px]" />
                  </div>
                  <div className="space-y-2.5 pt-2">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                    <div className="h-4 bg-slate-100 rounded w-11/12" />
                    <div className="h-4 bg-slate-100 rounded w-4/5" />
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-6 space-y-3">
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-11/12" />
                <div className="h-4 bg-slate-100 rounded w-full" />
              </div>
            </div>
            <div className="hidden lg:block space-y-6 border-l border-slate-200 pl-6">
              <div className="h-64 bg-slate-100 rounded" />
              <div className="h-56 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="bg-white min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full bg-white rounded-xl border border-slate-200 p-8 sm:p-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E] mb-3">
            {t('news.notFoundTitle')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mb-6">{t('news.notFoundDesc')}</p>
          <NavLink
            to="/news"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors"
          >
            <ChevronLeft size={16} />
            <span>{t('news.backToNews')}</span>
          </NavLink>
        </div>
      </div>
    );
  }

  const resolvedHeroImg = resolveAssetUrl(article.imageUrl, STATIC_ASSETS.rwandaNewsKagame);
  const categorySlug = (article.category || 'news').toLowerCase().replace(/\s+/g, '-');
  const introText = (article.summary || article.subtitle || '').trim();
  const formattedPubDate = safeFormatDate(article.publishedAt, 'MMM d, yyyy · HH:mm');

  return (
    <div className="bg-white min-h-screen relative pb-14">
      {/* Subtle reading progress indicator */}
      <div
        aria-hidden="true"
        className="fixed top-14 md:top-[74px] left-0 w-full h-[3px] z-40 pointer-events-none bg-transparent no-print"
      >
        <div
          className="bg-[#14B8A6] h-full transition-all duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Main 82% / 18% Two-Column News Layout */}
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-7">
        <div className="grid grid-cols-1 lg:grid-cols-[82fr_18fr] gap-8 lg:gap-7 items-start">
          {/* LEFT COLUMN (~82%): Article Header, Intro, Content, Comments */}
          <article className="min-w-0 w-full lg:col-start-1">
            {/* Breadcrumb Navigation */}
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-3 overflow-x-auto whitespace-nowrap scrollbar-hide no-print"
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
              <span className="text-[#102B4E] font-semibold truncate">{article.headline}</span>
            </nav>

            {/* 1. Article Title */}
            <header>
              <h1 className="text-[22px] leading-[1.28] sm:text-[26px] sm:leading-[1.24] lg:text-[30px] lg:leading-[1.22] font-bold text-[#1A1A1A] tracking-tight break-words">
                {article.headline}
              </h1>

              {/* 2. Author Information Row directly below Title */}
              <div className="mt-3.5 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] sm:text-sm min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AuthorAvatar
                    src={article.authorAvatar}
                    name={article.author}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-xs sm:text-sm shrink-0"
                  />
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                    <span className="text-slate-600 font-normal">Yanditswe na:</span>
                    <NavLink
                      to={`/news?author=${encodeURIComponent(article.author || 'Admin')}`}
                      className="text-[#083D91] hover:text-[#14B8A6] hover:underline font-medium truncate max-w-[200px] sm:max-w-none transition-colors"
                    >
                      {article.author || 'Editorial Team'}
                    </NavLink>
                  </div>
                </div>

                {formattedPubDate && (
                  <time
                    dateTime={article.publishedAt}
                    className="inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] text-slate-400 font-normal tabular-nums sm:ml-2 whitespace-nowrap"
                  >
                    <Clock size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                    <span>{formattedPubDate}</span>
                  </time>
                )}

                <a
                  href="#article-comments"
                  aria-label={`${comments.length} comments`}
                  className="ml-auto inline-flex items-center gap-1.5 text-[12px] sm:text-[13px] text-slate-500 hover:text-[#083D91] font-medium tabular-nums shrink-0 transition-colors"
                >
                  <MessageSquare size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <span>{comments.length}</span>
                </a>
              </div>
            </header>

            {/* 3. Featured Image & Introduction Section
                - Desktop/Tablet (md+): 43% Featured Image left | 57% Social Share (top) + Intro (vertically aligned) right
                - Mobile (< md): Social Share -> Featured Image -> Article Introduction */}
            <div className="grid grid-cols-1 md:grid-cols-[43fr_57fr] md:grid-rows-[auto_1fr] gap-4 md:gap-x-6 md:gap-y-3 items-start">
              {/* Social Sharing Buttons */}
              <div
                className="order-1 md:col-start-2 md:row-start-1 flex flex-wrap items-center md:justify-end gap-1.5 no-print"
                role="group"
                aria-label={t('news.share')}
              >
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                  className="w-9 h-9 rounded-[4px] bg-[#3B5998] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                >
                  <Facebook size={16} />
                </a>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(article.headline)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X"
                  className="w-9 h-9 rounded-[4px] bg-[#1DA1F2] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                >
                  <X size={15} />
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on LinkedIn"
                  className="w-9 h-9 rounded-[4px] bg-[#0077B5] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                >
                  <Linkedin size={16} />
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${article.headline} — ${shareUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on WhatsApp"
                  className="w-9 h-9 rounded-[4px] bg-[#25D366] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                >
                  <WhatsApp size={16} />
                </a>
                <a
                  href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${encodeURIComponent(resolvedHeroImg)}&description=${encodeURIComponent(article.headline)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Pinterest"
                  className="w-9 h-9 rounded-[4px] bg-[#CB2027] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                >
                  <Pinterest size={16} />
                </a>
              </div>

              {/* Featured Image (Left column on md+) */}
              <figure className="order-2 md:col-start-1 md:row-start-1 md:row-span-2 w-full">
                <button
                  type="button"
                  onClick={() => setZoomedImage(resolvedHeroImg)}
                  className="w-full block rounded-[4px] overflow-hidden border border-slate-200/80 bg-slate-50 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#083D91]"
                  aria-label="Expand featured image"
                >
                  <img
                    src={resolvedHeroImg}
                    alt={article.headline}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto object-contain block"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                    }}
                  />
                </button>
                {article.imageCaption && (
                  <figcaption className="text-[12px] text-slate-500 mt-1.5 leading-snug">
                    {article.imageCaption}
                  </figcaption>
                )}
              </figure>

              {/* Article Introduction / Excerpt (Right column below share buttons, vertically centered alongside featured image) */}
              {introText && (
                <div className="order-3 md:col-start-2 md:row-start-2 md:self-center">
                  <p className="text-[15px] sm:text-[16px] leading-[1.65] text-[#4B5563] font-normal">
                    {introText}
                  </p>
                </div>
              )}
            </div>

            {/* Thin Horizontal Divider */}
            <hr className="border-t border-slate-200 my-6 sm:my-7" />

            {/* 4. Full Article Content */}
            <div
              ref={proseContainerRef}
              className="article-prose w-full max-w-none overflow-x-hidden text-[15px] sm:text-[16px] leading-[1.65] text-left sm:text-justify"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />

            {/* Optional Article Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 pt-5 border-t border-slate-200 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
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

            {/* Utility Controls Bar */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 no-print">
              <NavLink
                to="/news"
                className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-semibold text-[#083D91] hover:text-[#14B8A6] transition-colors"
              >
                <ChevronLeft size={16} />
                <span>{t('news.backToNews')}</span>
              </NavLink>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    'min-h-[38px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors cursor-pointer',
                    copied
                      ? 'bg-[#14B8A6] text-white border-[#14B8A6]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#083D91] hover:text-[#083D91]'
                  )}
                >
                  {copied ? <Check size={14} /> : <Link2 size={14} />}
                  <span>{copied ? t('news.copied') : t('news.copyLink')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  aria-label={t('news.print')}
                  className="min-h-[38px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:border-[#083D91] hover:text-[#083D91] transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  <span>{t('news.print')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="min-h-[38px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 bg-white text-slate-600 border border-slate-200 hover:border-[#083D91] hover:text-[#083D91] transition-colors cursor-pointer"
                >
                  <span>{t('news.scrollTop')}</span>
                  <ArrowUp size={14} />
                </button>
              </div>
            </div>

            {/* Previous & Next Article Navigation */}
            {(prevArticle || nextArticle) && (
              <nav
                aria-label="Adjacent articles"
                className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 no-print"
              >
                {prevArticle ? (
                  <NavLink
                    to={`/news/${prevArticle.slug}`}
                    className="flex items-center gap-3.5 p-3.5 rounded-lg border border-slate-200 hover:border-[#083D91]/40 transition-colors group min-w-0"
                  >
                    <img
                      src={resolveAssetUrl(prevArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-[4px] object-cover shrink-0 bg-slate-100"
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
                    </div>
                  </NavLink>
                ) : (
                  <div className="hidden sm:block" />
                )}

                {nextArticle ? (
                  <NavLink
                    to={`/news/${nextArticle.slug}`}
                    className="flex items-center justify-between gap-3.5 p-3.5 rounded-lg border border-slate-200 hover:border-[#083D91]/40 transition-colors group min-w-0 sm:text-right"
                  >
                    <div className="min-w-0 flex-1 order-2 sm:order-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14B8A6]">
                        {t('news.nextArticle')}
                        <ArrowRight size={13} />
                      </span>
                      <p className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] line-clamp-2 leading-snug mt-0.5">
                        {nextArticle.headline}
                      </p>
                    </div>
                    <img
                      src={resolveAssetUrl(nextArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-16 h-12 rounded-[4px] object-cover shrink-0 bg-slate-100 order-1 sm:order-2"
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

            {/* Comments Section */}
            <section
              id="article-comments"
              aria-label="Article comments"
              className="mt-10 pt-8 border-t border-slate-200 space-y-6 no-print"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#102B4E] flex items-center gap-2">
                  <MessageSquare size={19} className="text-[#083D91]" />
                  <span>
                    {language === 'Kinyarwanda' ? 'Ibitekerezo' : 'Comments'} ({comments.length})
                  </span>
                </h2>
              </div>

              <form onSubmit={handleCommentSubmit} className="space-y-3 bg-slate-50/70 p-4 sm:p-5 rounded-lg border border-slate-200/80">
                <div>
                  <label
                    htmlFor="comment-author-name"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    {language === 'Kinyarwanda' ? 'Izina ryawe' : 'Your Name'}
                  </label>
                  <input
                    id="comment-author-name"
                    type="text"
                    required
                    maxLength={80}
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder={language === 'Kinyarwanda' ? 'Andika izina ryawe...' : 'Enter your name...'}
                    className="w-full sm:max-w-sm px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm text-[#102B4E] focus:outline-none focus:border-[#083D91]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="comment-body-input"
                    className="block text-xs font-semibold text-slate-600 mb-1"
                  >
                    {language === 'Kinyarwanda' ? 'Igitekerezo cyawe' : 'Your Comment'}
                  </label>
                  <textarea
                    id="comment-body-input"
                    required
                    maxLength={2000}
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      language === 'Kinyarwanda'
                        ? 'Tanga igitekerezo kuri iyi nkuru...'
                        : 'Share your thoughts on this article...'
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-[#102B4E] focus:outline-none focus:border-[#083D91] resize-y"
                  />
                </div>

                {commentStatus && (
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      commentStatus.type === 'success' ? 'text-emerald-700' : 'text-red-600'
                    )}
                  >
                    {commentStatus.message}
                  </p>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={commentSubmitting}
                    className="min-h-[40px] px-4 py-2 bg-[#083D91] hover:bg-[#07366D] disabled:opacity-60 text-white rounded-lg text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Send size={14} />
                    <span>
                      {commentSubmitting
                        ? language === 'Kinyarwanda'
                          ? 'Kohereza...'
                          : 'Posting...'
                        : language === 'Kinyarwanda'
                          ? 'Ohereza Igitekerezo'
                          : 'Post Comment'}
                    </span>
                  </button>
                </div>
              </form>

              {comments.length > 0 ? (
                <div className="divide-y divide-slate-200/80">
                  {comments.map((comment) => (
                    <div key={comment.id} className="py-4 first:pt-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#083D91]/10 text-[#083D91] font-bold text-xs flex items-center justify-center shrink-0">
                            {comment.authorName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-[#102B4E] truncate">
                            {comment.authorName}
                          </span>
                        </div>
                        <time className="text-xs text-slate-400 tabular-nums shrink-0">
                          {safeFormatDate(comment.createdAt, 'MMM d, yyyy · HH:mm')}
                        </time>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed pl-[42px] whitespace-pre-line break-words">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {language === 'Kinyarwanda'
                    ? 'Nta gitekerezo kiratangwa kuri iyi nkuru. Ba uwa mbere gutanga igitekerezo.'
                    : 'No comments yet. Be the first to share your thoughts.'}
                </p>
              )}
            </section>
          </article>

          {/* RIGHT COLUMN (~18%): Advertising Sidebar
              - Desktop (lg+): Sticky/vertical right column (~18%) alongside article
              - Mobile (< lg): Displays cleanly below article content */}
          <aside
            aria-label="Advertisements"
            className="w-full min-w-0 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:border-l lg:border-slate-200/80 lg:pl-6 pt-6 lg:pt-0 border-t lg:border-t-0 border-slate-200 no-print"
          >
            {activeSidebarAds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                {activeSidebarAds.map((ad) => (
                  <SidebarAdItem key={ad.id} ad={ad} />
                ))}
              </div>
            ) : null}
          </aside>

          {/* RELATED ARTICLES SECTION (Below Main Article) */}
          <section
            aria-label={relatedMode === 'related' ? t('news.relatedTitle') : t('news.latestTitle')}
            className="min-w-0 w-full lg:col-start-1 mt-4 pt-8 border-t border-slate-200 space-y-5 no-print"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#102B4E]">
                {relatedMode === 'related' ? t('news.relatedTitle') : t('news.latestTitle')}
              </h2>
              <NavLink
                to="/news"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#083D91] hover:text-[#14B8A6] transition-colors"
              >
                <span>{t('section.news.cta')}</span>
                <ArrowRight size={15} />
              </NavLink>
            </div>

            {relatedItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                {relatedItems.map((item) => (
                  <NavLink
                    key={item.id}
                    to={`/news/${item.slug}`}
                    className="border border-slate-200/80 hover:border-[#083D91]/40 rounded-[6px] overflow-hidden flex flex-col group transition-colors bg-white"
                  >
                    <div className="aspect-[16/10] bg-slate-100 overflow-hidden shrink-0">
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
                    <div className="p-3.5 flex flex-col flex-1 min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] mb-1 truncate">
                        {item.category}
                      </span>
                      <h3 className="text-[15px] font-bold text-[#102B4E] group-hover:text-[#083D91] transition-colors leading-snug break-words">
                        {item.headline}
                      </h3>
                      <span className="mt-auto pt-2.5 text-xs text-slate-400 font-medium tabular-nums">
                        {safeFormatDate(item.publishedAt, 'MMM d, yyyy')}
                      </span>
                    </div>
                  </NavLink>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('news.emptyAll')}</p>
            )}
          </section>
        </div>
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
            className="max-w-full max-h-[88vh] rounded-[4px] object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
}
