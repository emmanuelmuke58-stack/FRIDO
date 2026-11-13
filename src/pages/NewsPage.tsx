import React from 'react';
import {
  Calendar,
  ArrowRight,
  Clock,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from 'lucide-react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CategoryItem, NewsItem } from '@/src/types';
import { cn, safeFormatDate } from '@/src/lib/utils';
import {
  fetchPublicPortalData,
  calculateReadingTime,
  PUBLIC_DATA_UPDATED_EVENT,
} from '@/src/lib/publicData';
import { STATIC_ASSETS, resolveAssetUrl } from '@/src/lib/assets';
import { useLanguage } from '@/src/lib/LanguageContext';

const CANONICAL_NEWS_CATEGORIES: { slug: string; label: string; aliases: string[] }[] = [
  { slug: 'business', label: 'Business', aliases: ['business'] },
  { slug: 'economy', label: 'Economy', aliases: ['economy'] },
  { slug: 'technology', label: 'Technology', aliases: ['technology', 'tech'] },
  { slug: 'education', label: 'Education', aliases: ['education', 'updates'] },
  { slug: 'international', label: 'International', aliases: ['international', 'world'] },
];

const PAGE_SIZE = 10;

export function NewsListingPage() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const langParam = searchParams.get('lang') || '';
  const initialQuery = searchParams.get('q') || '';

  const [allNews, setAllNews] = React.useState<NewsItem[]>([]);
  const [dbCategories, setDbCategories] = React.useState<CategoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState(initialQuery);
  const [sortBy, setSortBy] = React.useState<'newest'| 'most_read'>('newest');
  const [page, setPage] = React.useState(1);

  const loadData = React.useCallback(async (force = false) => {
    setLoading(true);
    try {
      const portal = await fetchPublicPortalData(force);
      setAllNews(portal.news);
      setDbCategories(portal.categories.filter((c) => c.module === 'News'));
    } catch (e) {
      console.error('Failed to load news listing:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData(false);
    const onUpdate = () => loadData(true);
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
  }, [loadData]);

  React.useEffect(() => {
    setPage(1);
  }, [category, langParam, searchTerm, sortBy]);

  const categoryFilters = React.useMemo(() => {
    const items: { slug: string; label: string; path: string; aliases: string[] }[] = CANONICAL_NEWS_CATEGORIES.map(
      (cat) => ({
        ...cat,
        path: `/news/category/${cat.slug}`,
      })
    );

    const knownSlugs = new Set(items.map((i) => i.slug.toLowerCase()));
    const knownAliases = new Set(items.flatMap((i) => i.aliases));

    dbCategories.forEach((cat) => {
      const slug = cat.slug.toLowerCase();
      const nameLower = cat.name.toLowerCase();
      if (!knownSlugs.has(slug) && !knownAliases.has(nameLower)) {
        items.push({
          slug,
          label: cat.name,
          path: `/news/category/${cat.slug}`,
          aliases: [nameLower, slug],
        });
      }
    });

    return items;
  }, [dbCategories]);

  const activeLanguage = React.useMemo(() => {
    if (langParam.toLowerCase() === 'kinyarwanda'|| category?.toLowerCase() === 'rwanda-kinyarwanda') {
      return 'Kinyarwanda';
    }
    if (langParam.toLowerCase() === 'english'|| category?.toLowerCase() === 'rwanda-english') {
      return 'English';
    }
    return 'All';
  }, [langParam, category]);

  const activeCategoryObj = React.useMemo(() => {
    if (!category) return null;
    const lower = category.toLowerCase();
    if (lower === 'rwanda-kinyarwanda'|| lower === 'rwanda-english') return null;
    return (
      categoryFilters.find(
        (c) => c.slug.toLowerCase() === lower || c.aliases.includes(lower)
      ) || {
        slug: lower,
        label: category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        path: `/news/category/${category}`,
        aliases: [lower, category.replace(/-/g, ' ').toLowerCase()],
      }
    );
  }, [category, categoryFilters]);

  const activeDbCategory = React.useMemo(() => {
    if (!activeCategoryObj) return null;
    return dbCategories.find(
      (c) =>
        c.slug.toLowerCase() === activeCategoryObj.slug.toLowerCase() ||
        c.name.toLowerCase() === activeCategoryObj.label.toLowerCase()
    ) || null;
  }, [activeCategoryObj, dbCategories]);

  const filteredNews = React.useMemo(() => {
    let items = [...allNews];

    if (activeCategoryObj) {
      const aliasSet = new Set(activeCategoryObj.aliases.map((a) => a.toLowerCase()));
      aliasSet.add(activeCategoryObj.label.toLowerCase());
      aliasSet.add(activeCategoryObj.slug.toLowerCase());
      items = items.filter((n) => aliasSet.has((n.category || '').trim().toLowerCase()));
    }

    if (activeLanguage !== 'All') {
      items = items.filter(
        (n) => (n.language || '').toLowerCase() === activeLanguage.toLowerCase()
      );
    }

    const q = searchTerm.trim().toLowerCase();
    if (q) {
      items = items.filter((n) => {
        const haystack = [
          n.headline,
          n.subtitle,
          n.summary,
          n.author,
          n.category,
          ...(n.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (sortBy === 'most_read') {
      items.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else {
      items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    }

    return items;
  }, [allNews, activeCategoryObj, activeLanguage, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredNews.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageItems = React.useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNews.slice(start, start + PAGE_SIZE);
  }, [filteredNews, currentPage]);

  const showLeadStory = currentPage === 1 && pageItems.length > 0 && !searchTerm.trim();
  const leadStory = showLeadStory ? pageItems[0] : null;
  const gridStories = showLeadStory ? pageItems.slice(1) : pageItems;

  const handleLanguageSelect = (targetLang: 'All'| 'Kinyarwanda'| 'English') => {
    const next = new URLSearchParams(searchParams);
    if (targetLang === 'All') {
      next.delete('lang');
    } else {
      next.set('lang', targetLang);
    }

    if (category?.toLowerCase() === 'rwanda-kinyarwanda'|| category?.toLowerCase() === 'rwanda-english') {
      const qs = next.toString();
      navigate(qs ? `/news?${qs}` : '/news');
      return;
    }

    setSearchParams(next);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setSortBy('newest');
    setPage(1);
    navigate('/news');
  };

  const pageHeading = activeCategoryObj
    ? `${activeCategoryObj.label} ${t('nav.news')}`
    : activeLanguage !== 'All'? `${t('news.title')} (${activeLanguage})`
      : t('news.title');

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Editorial Masthead */}
        <header className="mb-6 md:mb-8">
          <nav
            aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-3 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <NavLink to="/" className="hover:text-[#083D91] transition-colors shrink-0">
              {t('nav.home')}
            </NavLink>
            <span aria-hidden="true" className="text-slate-300">/</span>
            <NavLink
              to="/news" className={cn(
                'transition-colors shrink-0',
                !activeCategoryObj && activeLanguage === 'All'? 'text-[#102B4E] font-bold': 'hover:text-[#083D91]')}
            >
              {t('nav.news')}
            </NavLink>
            {activeCategoryObj && (
              <>
                <span aria-hidden="true" className="text-slate-300">/</span>
                <span className="text-[#102B4E] font-bold truncate">{activeCategoryObj.label}</span>
              </>
            )}
            {!activeCategoryObj && activeLanguage !== 'All'&& (
              <>
                <span aria-hidden="true" className="text-slate-300">/</span>
                <span className="text-[#102B4E] font-bold truncate">{activeLanguage}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200/80">
            <div className="flex items-center gap-4 max-w-3xl min-w-0">
              {(activeDbCategory?.thumbnailUrl || activeDbCategory?.imageUrl) && (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-slate-200 bg-white shrink-0 shadow-xs">
                  <img
                    src={activeDbCategory.thumbnailUrl || activeDbCategory.imageUrl}
                    alt={activeDbCategory.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-[28px] sm:text-4xl md:text-[42px] font-bold text-[#102B4E] leading-[1.15] text-balance">
                  {pageHeading}
                </h1>
                <p className="text-sm sm:text-base text-slate-600 mt-2 leading-relaxed">
                  {t('news.subtitle')}
                </p>
              </div>
            </div>
            {!loading && (
              <div className="text-xs sm:text-sm font-semibold text-slate-500 tabular-nums shrink-0">
                <span className="text-[#102B4E] font-bold">{filteredNews.length}</span>{' '}
                {filteredNews.length === 1 ? t('news.articlePublished') : t('news.articlesPublished')}
              </div>
            )}
          </div>
        </header>

        {/* Search, Language & Sort Toolbar */}
        <section
          aria-label="Filter and search news" className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 mb-5 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <input
                type="search" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('news.searchPlaceholder')}
                className="w-full min-h-[44px] pl-10 pr-10 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-sm text-[#102B4E] placeholder:text-slate-400 focus:outline-none focus:border-[#14B8A6] focus:bg-white transition-colors"/>
              {searchTerm && (
                <button
                  type="button" onClick={() => setSearchTerm('')}
                  aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-2.5">
              {/* Language Segmented Switcher */}
              <div
                role="group" aria-label="Filter by article language" className="inline-flex items-center p-1 bg-[#F1F5F9] rounded-xl border border-slate-200/60">
                {(['All', 'Kinyarwanda', 'English'] as const).map((langOpt) => {
                  const isActive = activeLanguage === langOpt;
                  return (
                    <button
                      key={langOpt}
                      type="button" onClick={() => handleLanguageSelect(langOpt)}
                      className={cn(
                        'min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                        isActive
                          ? 'bg-[#083D91] text-white shadow-xs': 'text-slate-600 hover:text-[#102B4E]')}
                    >
                      {langOpt === 'All'? t('search.allLanguages') : langOpt}
                    </button>
                  );
                })}
              </div>

              {/* Sort Select */}
              <select
                aria-label="Sort articles" value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest'| 'most_read')}
                className="min-h-[44px] px-3.5 py-2 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-[#102B4E] focus:outline-none focus:border-[#14B8A6] cursor-pointer shrink-0">
                <option value="newest">{t('news.sortNewest')}</option>
                <option value="most_read">{t('news.sortMostRead')}</option>
              </select>
            </div>
          </div>

          {/* Horizontal Category Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-hide">
            <NavLink
              to={activeLanguage !== 'All'? `/news?lang=${activeLanguage}` : '/news'}
              className={cn(
                'min-h-[38px] inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0',
                !activeCategoryObj
                  ? 'bg-[#102B4E] text-white': 'bg-[#F1F5F9] text-slate-600 hover:text-[#083D91] hover:bg-slate-200/70')}
            >
              {t('news.allNews')}
            </NavLink>
            {categoryFilters.map((cat) => {
              const isSelected = activeCategoryObj?.slug === cat.slug;
              const targetPath =
                activeLanguage !== 'All'? `${cat.path}?lang=${activeLanguage}` : cat.path;
              return (
                <NavLink
                  key={cat.slug}
                  to={targetPath}
                  className={cn(
                    'min-h-[38px] inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0',
                    isSelected
                      ? 'bg-[#102B4E] text-white': 'bg-[#F1F5F9] text-slate-600 hover:text-[#083D91] hover:bg-slate-200/70')}
                >
                  {cat.label}
                </NavLink>
              );
            })}
          </div>
        </section>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 animate-pulse">
              <div className="lg:col-span-7 aspect-[16/10] bg-slate-200"/>
              <div className="lg:col-span-5 p-6 sm:p-8 space-y-4">
                <div className="h-4 w-32 bg-slate-200 rounded"/>
                <div className="h-8 w-full bg-slate-200 rounded"/>
                <div className="h-8 w-3/4 bg-slate-200 rounded"/>
                <div className="h-20 w-full bg-slate-100 rounded"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden animate-pulse">
                  <div className="aspect-[16/10] bg-slate-200"/>
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-28 bg-slate-200 rounded"/>
                    <div className="h-6 w-full bg-slate-200 rounded"/>
                    <div className="h-14 w-full bg-slate-100 rounded"/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredNews.length === 0 ? (
          /* Honest Empty State */
          <div className="bg-white rounded-2xl border border-slate-200/80 p-10 md:p-16 text-center max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F1F5F9] text-[#083D91] flex items-center justify-center mx-auto mb-4">
              <Newspaper size={26} />
            </div>
            <h2 className="text-xl font-bold text-[#102B4E] mb-2">
              {allNews.length > 0 ? t('news.emptyFiltered') : t('news.emptyAll')}
            </h2>
            {allNews.length > 0 && (
              <button
                type="button" onClick={resetAllFilters}
                className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#083D91] hover:bg-[#07366D] text-white text-sm font-bold transition-colors cursor-pointer">
                {t('news.resetFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Lead Story Feature */}
            {leadStory && (
              <article className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all grid grid-cols-1 lg:grid-cols-12 items-stretch group">
                <NavLink
                  to={`/news/${leadStory.slug}`}
                  className="lg:col-span-7 relative aspect-[16/10] lg:aspect-auto lg:min-h-[360px] bg-slate-100 overflow-hidden block">
                  <img
                    src={resolveAssetUrl(leadStory.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                    alt={leadStory.headline}
                    referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                    }}
                  />
                </NavLink>
                <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[#14B8A6] mb-3">
                      <span>{t('news.leadStory')}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>{leadStory.category}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-slate-500 font-semibold">{leadStory.language}</span>
                    </div>

                    <h2 className="text-2xl sm:text-[28px] font-bold text-[#102B4E] leading-[1.2] text-balance group-hover:text-[#083D91] transition-colors">
                      <NavLink to={`/news/${leadStory.slug}`}>{leadStory.headline}</NavLink>
                    </h2>

                    <p className="text-sm sm:text-base text-slate-600 mt-3.5 leading-relaxed line-clamp-4">
                      {leadStory.summary}
                    </p>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 font-medium tabular-nums">
                      <span className="font-semibold text-[#102B4E]">{leadStory.author}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-[#14B8A6]"/>
                        {safeFormatDate(leadStory.publishedAt, 'MMM dd, yyyy')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} className="text-[#14B8A6]"/>
                        {calculateReadingTime(leadStory.content)} {t('card.minRead')}
                      </span>
                    </div>

                    <NavLink
                      to={`/news/${leadStory.slug}`}
                      className="min-h-[44px] w-full sm:w-fit inline-flex items-center justify-center gap-2 bg-[#083D91] hover:bg-[#07366D] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
                      <span>{t('card.readFull')}</span>
                      <ArrowRight size={16} />
                    </NavLink>
                  </div>
                </div>
              </article>
            )}

            {/* Editorial Story Grid */}
            {gridStories.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridStories.map((item) => (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-[#14B8A6] hover:shadow-md transition-all flex flex-col group">
                    <NavLink
                      to={`/news/${item.slug}`}
                      className="aspect-[16/10] bg-slate-100 overflow-hidden block shrink-0">
                      <img
                        src={resolveAssetUrl(item.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                        alt={item.headline}
                        loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                        }}
                      />
                    </NavLink>

                    <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-[#14B8A6] mb-2">
                          <span>{item.category}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-500 font-semibold">{item.language}</span>
                        </div>

                        <h2 className="text-lg sm:text-[19px] font-bold text-[#102B4E] leading-snug line-clamp-2 group-hover:text-[#083D91] transition-colors">
                          <NavLink to={`/news/${item.slug}`}>{item.headline}</NavLink>
                        </h2>

                        <p className="text-sm text-slate-600 mt-2.5 line-clamp-3 leading-relaxed">
                          {item.summary}
                        </p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                        <div className="flex items-center gap-2 min-w-0 truncate">
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Calendar size={12} className="text-[#14B8A6]"/>
                            {safeFormatDate(item.publishedAt, 'MMM dd, yyyy')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">
                            {calculateReadingTime(item.content)} {t('card.minRead')}
                          </span>
                        </div>

                        <NavLink
                          to={`/news/${item.slug}`}
                          className="inline-flex items-center gap-1 text-[#083D91] group-hover:text-[#14B8A6] font-bold shrink-0 py-1">
                          <span>{t('cat.news.cta')}</span>
                          <ArrowRight size={14} />
                        </NavLink>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav
                aria-label="News pagination" className="flex items-center justify-center gap-2 pt-4">
                <button
                  type="button" disabled={currentPage === 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo({ top: 0, behavior: 'smooth'});
                  }}
                  className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 bg-white text-[#102B4E] font-bold text-sm inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#14B8A6] cursor-pointer" aria-label="Previous page">
                  <ChevronLeft size={18} />
                </button>

                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  return (
                    <button
                      key={pNum}
                      type="button" onClick={() => {
                        setPage(pNum);
                        window.scrollTo({ top: 0, behavior: 'smooth'});
                      }}
                      className={cn(
                        'min-h-[44px] min-w-[44px] px-3.5 rounded-xl font-bold text-sm tabular-nums transition-colors cursor-pointer',
                        pNum === currentPage
                          ? 'bg-[#083D91] text-white': 'bg-white border border-slate-200 text-slate-600 hover:border-[#14B8A6] hover:text-[#083D91]')}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button" disabled={currentPage === totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 0, behavior: 'smooth'});
                  }}
                  className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 bg-white text-[#102B4E] font-bold text-sm inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#14B8A6] cursor-pointer" aria-label="Next page">
                  <ChevronRight size={18} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
