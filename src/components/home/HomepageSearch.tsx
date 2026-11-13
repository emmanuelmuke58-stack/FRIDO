import React from 'react';
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  X,
  SlidersHorizontal,
  Building2,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { CategoryItem, HomepageSectionConfig, NewsItem, Opportunity } from '@/src/types';
import { useLanguage } from '@/src/lib/LanguageContext';
import { calculateReadingTime, getOpportunityRoutePath } from '@/src/lib/publicData';
import { cn, safeDate, safeFormatDate } from '@/src/lib/utils';

interface HomepageSearchProps {
  config?: HomepageSectionConfig;
  news: NewsItem[];
  opportunities: Opportunity[];
  categories: CategoryItem[];
  locations: string[];
}

const PAGE_SIZE = 6;

export function HomepageSearch({
  config,
  news,
  opportunities,
  categories,
  locations,
}: HomepageSearchProps) {
  const { t } = useLanguage();
  const [keyword, setKeyword] = React.useState('');
  const [contentType, setContentType] = React.useState<'all'| 'News'| 'Jobs'| 'Scholarships'| 'Tenders'| 'Others'>('all');
  const [selectedCategory, setSelectedCategory] = React.useState('all');
  const [selectedLocation, setSelectedLocation] = React.useState('all');
  const [selectedLang, setSelectedLang] = React.useState<'all'| 'English'| 'Kinyarwanda'>('all');
  const [sortBy, setSortBy] = React.useState<'newest'| 'deadline'>('newest');
  const [showFilters, setShowFilters] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const hasActiveQuery =
    keyword.trim().length > 0 ||
    contentType !== 'all'||
    selectedCategory !== 'all'||
    selectedLocation !== 'all'||
    selectedLang !== 'all';

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => {
      if (contentType === 'all'|| c.module === contentType) {
        set.add(c.name);
      }
    });
    if (contentType === 'all'|| contentType === 'News') {
      news.forEach((n) => n.category && set.add(n.category));
    }
    if (contentType !== 'News') {
      opportunities.forEach((o) => {
        if (contentType === 'all'|| o.category === contentType) {
          if (o.subCategory) set.add(o.subCategory);
        }
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, contentType, news, opportunities]);

  const matchedItems = React.useMemo(() => {
    if (!hasActiveQuery) return [];
    const q = keyword.trim().toLowerCase();

    type ResultEntry =
      | { kind: 'news'; item: NewsItem; dateStr: string }
      | { kind: 'opp'; item: Opportunity; dateStr: string };

    const entries: ResultEntry[] = [];

    if (contentType === 'all'|| contentType === 'News') {
      news.forEach((article) => {
        if (selectedLang !== 'all'&& article.language !== selectedLang) return;
        if (selectedCategory !== 'all'&& article.category.toLowerCase() !== selectedCategory.toLowerCase()) return;
        if (selectedLocation !== 'all') return; // location applies to opportunities
        if (q) {
          const hay = `${article.headline} ${article.subtitle || ''} ${article.summary || ''} ${article.category} ${article.author}`.toLowerCase();
          if (!hay.includes(q)) return;
        }
        entries.push({ kind: 'news', item: article, dateStr: article.publishedAt || ''});
      });
    }

    if (contentType !== 'News') {
      opportunities.forEach((opp) => {
        if (contentType !== 'all'&& opp.category !== contentType) return;
        if (selectedCategory !== 'all') {
          const matchesSub = (opp.subCategory || '').toLowerCase() === selectedCategory.toLowerCase();
          const matchesCat = opp.category.toLowerCase() === selectedCategory.toLowerCase();
          if (!matchesSub && !matchesCat) return;
        }
        if (selectedLocation !== 'all'&& (opp.location || '').toLowerCase() !== selectedLocation.toLowerCase()) return;
        if (selectedLang !== 'all'&& selectedLang === 'Kinyarwanda') return; // opportunities default EN unless tagged
        if (q) {
          const hay = `${opp.title} ${opp.organization} ${opp.location} ${opp.category} ${opp.subCategory || ''} ${opp.type || ''} ${opp.tenderRef || ''}`.toLowerCase();
          if (!hay.includes(q)) return;
        }
        entries.push({
          kind: 'opp',
          item: opp,
          dateStr: sortBy === 'deadline'? opp.deadline || '': opp.createdAt || '',
        });
      });
    }

    entries.sort((a, b) => {
      if (sortBy === 'deadline') {
        const da = a.kind === 'opp'? safeDate(a.item.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        const db = b.kind === 'opp'? safeDate(b.item.deadline)?.getTime() ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
        return da - db;
      }
      return (b.dateStr || '').localeCompare(a.dateStr || '');
    });

    return entries;
  }, [hasActiveQuery, keyword, contentType, selectedCategory, selectedLocation, selectedLang, sortBy, news, opportunities]);

  React.useEffect(() => {
    setPage(1);
  }, [keyword, contentType, selectedCategory, selectedLocation, selectedLang, sortBy]);

  const totalPages = Math.max(1, Math.ceil(matchedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = matchedItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetAll = () => {
    setKeyword('');
    setContentType('all');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedLang('all');
    setSortBy('newest');
  };

  return (
    <section className="bg-[#F1F5F9] py-8 md:py-10 px-4 sm:px-6 border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[#102B4E]">
                {config?.title || t('search.heading')}
              </h2>
              {config?.description && (
                <p className="text-xs md:text-sm text-slate-500 mt-0.5">{config.description}</p>
              )}
            </div>
            <button
              type="button" onClick={() => setShowFilters((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#083D91] hover:text-[#14B8A6] self-start md:self-auto cursor-pointer">
              <SlidersHorizontal size={14} />
              <span>{showFilters ? 'Hide Advanced Filters': 'Advanced Filters'}</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1 min-w-0">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input
                type="text" value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('search.placeholder')}
                className="w-full min-h-[44px] pl-10 pr-10 py-3 bg-[#F1F5F9] border border-slate-200 rounded-xl text-sm text-[#102B4E] focus:outline-none focus:bg-white focus:border-[#14B8A6] transition-colors"/>
              {keyword && (
                <button
                  type="button" onClick={() => setKeyword('')}
                  aria-label="Clear keyword" className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {(['all', 'News', 'Jobs', 'Scholarships', 'Tenders', 'Others'] as const).map((type) => (
                <button
                  key={type}
                  type="button" onClick={() => {
                    setContentType(type);
                    setSelectedCategory('all');
                  }}
                  className={cn(
                    'min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border',
                    contentType === type
                      ? 'bg-[#083D91] text-white border-[#083D91]': 'bg-white text-[#102B4E] border-slate-200 hover:border-[#14B8A6]')}
                >
                  {type === 'all'? t('search.allTypes') : type}
                </button>
              ))}
            </div>
          </div>

          {(showFilters || hasActiveQuery) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                aria-label="Filter by category" className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#102B4E] focus:outline-none focus:border-[#14B8A6]">
                <option value="all">{t('search.allCategories')}</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                aria-label="Filter by location" className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#102B4E] focus:outline-none focus:border-[#14B8A6]">
                <option value="all">{t('search.allLocations')}</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value as any)}
                aria-label="Filter by language" className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#102B4E] focus:outline-none focus:border-[#14B8A6]">
                <option value="all">{t('search.allLanguages')}</option>
                <option value="English">English</option>
                <option value="Kinyarwanda">Kinyarwanda</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort results" className="w-full min-h-[44px] px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-[#102B4E] focus:outline-none focus:border-[#14B8A6]">
                <option value="newest">{t('search.sortNewest')}</option>
                <option value="deadline">{t('search.sortDeadline')}</option>
              </select>
            </div>
          )}

          {/* Live Filtered Results Panel */}
          {hasActiveQuery && (
            <div className="mt-6 pt-5 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <p className="text-xs font-bold text-[#102B4E]">
                  {matchedItems.length} {t('search.resultsCount')}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    type="button" onClick={resetAll}
                    className="text-xs font-bold text-slate-500 hover:text-red-600 cursor-pointer">
                    {t('search.clear')}
                  </button>
                  {keyword.trim() && (
                    <NavLink
                      to={`/search?q=${encodeURIComponent(keyword.trim())}`}
                      className="text-xs font-bold text-[#14B8A6] hover:underline inline-flex items-center gap-1">
                      Open Search Portal <ArrowRight size={13} />
                    </NavLink>
                  )}
                </div>
              </div>

              {paginated.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-sm font-semibold text-slate-600">{t('search.noResults')}</p>
                  <button
                    type="button" onClick={resetAll}
                    className="mt-3 text-xs font-bold text-[#083D91] hover:underline cursor-pointer">
                    {t('search.clear')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paginated.map((entry) => {
                      if (entry.kind === 'news') {
                        const a = entry.item;
                        return (
                          <NavLink
                            key={`news-${a.id}`}
                            to={`/news/${a.slug}`}
                            className="p-4 rounded-xl border border-slate-200 hover:border-[#14B8A6] bg-white hover:shadow-md transition-all flex flex-col justify-between group">
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] mb-1.5">
                                News · {a.category} · {a.language}
                              </div>
                              <h3 className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] line-clamp-2 mb-2">
                                {a.headline}
                              </h3>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3">{a.summary}</p>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                              <span className="flex items-center gap-1">
                                <Calendar size={11} />
                                {safeFormatDate(a.publishedAt, 'MMM dd, yyyy')}
                              </span>
                              <span>
                                {calculateReadingTime(a.content)} {t('card.minRead')}
                              </span>
                            </div>
                          </NavLink>
                        );
                      }

                      const o = entry.item;
                      return (
                        <NavLink
                          key={`opp-${o.id}`}
                          to={getOpportunityRoutePath(o)}
                          className="p-4 rounded-xl border border-slate-200 hover:border-[#14B8A6] bg-white hover:shadow-md transition-all flex flex-col justify-between group">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-[#083D91] mb-1.5">
                              {o.category}
                              {o.subCategory ? ` · ${o.subCategory}` : ''}
                            </div>
                            <h3 className="text-sm font-bold text-[#102B4E] group-hover:text-[#14B8A6] line-clamp-2 mb-2">
                              {o.title}
                            </h3>
                            <div className="space-y-1 text-xs text-slate-600 mb-3">
                              <div className="flex items-center gap-1.5 truncate">
                                <Building2 size={12} className="text-slate-400 flex-shrink-0"/>
                                <span className="truncate">{o.organization}</span>
                              </div>
                              <div className="flex items-center gap-1.5 truncate">
                                <MapPin size={12} className="text-slate-400 flex-shrink-0"/>
                                <span className="truncate">{o.location}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                            <span className="flex items-center gap-1 font-semibold text-red-600">
                              <Clock size={11} />
                              {t('card.deadline')}: {safeFormatDate(o.deadline, 'dd MMM yyyy')}
                            </span>
                            <span className="font-bold text-[#14B8A6] inline-flex items-center gap-1">
                              {t('card.viewDetails')} <ArrowRight size={12} />
                            </span>
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-5">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button" onClick={() => setPage(p)}
                          className={cn(
                            'min-w-[40px] min-h-[40px] rounded-lg text-xs font-bold transition-colors cursor-pointer',
                            p === safePage
                              ? 'bg-[#083D91] text-white': 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
