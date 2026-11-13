import React from 'react';
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Briefcase,
  ChevronRight,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { HomepageSectionConfig, NewsItem, Opportunity } from '@/src/types';
import { useLanguage } from '@/src/lib/LanguageContext';
import { STATIC_ASSETS, resolveAssetUrl } from '@/src/lib/assets';
import { calculateReadingTime, getOpportunityRoutePath } from '@/src/lib/publicData';
import { incrementCounter } from '@/src/lib/services';
import { cn, safeFormatDate } from '@/src/lib/utils';

interface NewsColumnProps {
  config?: HomepageSectionConfig;
  news: NewsItem[];
  loading?: boolean;
}

export function LatestNewsBlock({ config, news, loading }: NewsColumnProps) {
  const { language, t } = useLanguage();
  const [langFilter, setLangFilter] = React.useState<'priority'| 'English'| 'Kinyarwanda'>('priority');
  const limit = config?.limit || 4;

  const displayedNews = React.useMemo(() => {
    let list = [...news];
    if (config?.featuredCategories && config.featuredCategories.length > 0) {
      const catSet = new Set(config.featuredCategories.map((c) => c.toLowerCase()));
      const filtered = list.filter((n) => catSet.has((n.category || '').toLowerCase()));
      if (filtered.length > 0) list = filtered;
    }

    if (langFilter === 'English'|| langFilter === 'Kinyarwanda') {
      list = list.filter((n) => n.language === langFilter);
    } else {
      // Prioritize visitor's chosen top-bar language while keeping all published news accessible
      list.sort((a, b) => {
        const aMatch = a.language === language ? 1 : 0;
        const bMatch = b.language === language ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return (b.publishedAt || '').localeCompare(a.publishedAt || '');
      });
    }
    return list.slice(0, limit);
  }, [news, config?.featuredCategories, langFilter, language, limit]);

  const leadArticle = displayedNews[0];
  const secondaryArticles = displayedNews.slice(1);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-5 border-b border-slate-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
            {config?.title || t('section.news')}
          </h2>
          {config?.description && (
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-bold">
            {(['priority', 'Kinyarwanda', 'English'] as const).map((opt) => (
              <button
                key={opt}
                type="button" onClick={() => setLangFilter(opt)}
                className={cn(
                  'px-2 py-1 rounded-md transition-colors cursor-pointer',
                  langFilter === opt ? 'bg-[#083D91] text-white': 'text-slate-600 hover:text-[#083D91]')}
              >
                {opt === 'priority'? 'All': opt === 'Kinyarwanda'? 'RW': 'EN'}
              </button>
            ))}
          </div>
          <NavLink
            to="/news" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap">
            <span>{t('section.news.cta')}</span>
            <ArrowRight size={14} />
          </NavLink>
        </div>
      </div>

      {loading ? (
        <div className="h-72 rounded-2xl bg-slate-100 animate-pulse"/>
      ) : displayedNews.length === 0 ? (
        <div className="bg-[#F1F5F9] rounded-2xl p-8 text-center border border-slate-200/70">
          <p className="text-sm font-semibold text-[#102B4E]">No published news articles available right now.</p>
          <p className="text-xs text-slate-500 mt-1">Published stories will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Lead Editorial Card */}
          {leadArticle && (
            <article className="min-w-0 md:col-span-6 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
              <div>
                <NavLink to={`/news/${leadArticle.slug}`} className="block aspect-[16/10] bg-slate-100 overflow-hidden">
                  <img
                    src={resolveAssetUrl(leadArticle.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                    alt={leadArticle.headline}
                    loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                    }}
                  />
                </NavLink>
                <div className="p-4 sm:p-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] mb-1.5">
                    {leadArticle.category} · {leadArticle.language}
                  </div>
                  <h3 className="text-lg font-bold text-[#102B4E] leading-snug mb-2 group-hover:text-[#083D91] transition-colors line-clamp-2">
                    <NavLink to={`/news/${leadArticle.slug}`}>{leadArticle.headline}</NavLink>
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 font-medium mb-2.5">
                    <span>{leadArticle.author}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {safeFormatDate(leadArticle.publishedAt, 'MMM dd, yyyy')}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {calculateReadingTime(leadArticle.content)} {t('card.minRead')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                    {leadArticle.summary}
                  </p>
                </div>
              </div>
              <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                <NavLink
                  to={`/news/${leadArticle.slug}`}
                  className="w-full bg-[#083D91] hover:bg-[#07366D] text-white py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors">
                  <span>{t('card.readFull')}</span>
                  <ArrowRight size={14} />
                </NavLink>
              </div>
            </article>
          )}

          {/* Stacked Secondary Stories */}
          <div className="md:col-span-6 flex flex-col gap-3.5">
            {secondaryArticles.map((article) => (
              <NavLink
                key={article.id}
                to={`/news/${article.slug}`}
                className="flex gap-3 sm:gap-3.5 p-3 rounded-2xl bg-white border border-slate-200/80 hover:border-[#14B8A6] hover:shadow-md transition-all group min-w-0">
                <div className="w-20 h-20 sm:w-28 sm:h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                  <img
                    src={resolveAssetUrl(article.imageUrl, STATIC_ASSETS.rwandaNewsKagame)}
                    alt={article.headline}
                    loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaNewsKagame;
                    }}
                  />
                </div>
                <div className="min-w-0 flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#14B8A6] mb-1 truncate">
                    {article.category} · {article.language}
                  </div>
                  <h4 className="text-sm font-bold text-[#102B4E] group-hover:text-[#083D91] transition-colors line-clamp-2 leading-snug mb-1.5">
                    {article.headline}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={10} />
                      {safeFormatDate(article.publishedAt, 'MMM dd, yyyy')}
                    </span>
                    <span>·</span>
                    <span>
                      {calculateReadingTime(article.content)} {t('card.minRead')}
                    </span>
                  </div>
                </div>
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface JobsColumnProps {
  config?: HomepageSectionConfig;
  jobs: Opportunity[];
  loading?: boolean;
}

export function LatestJobsBlock({ config, jobs, loading }: JobsColumnProps) {
  const { t } = useLanguage();
  const limit = config?.limit || 4;

  const displayedJobs = React.useMemo(() => {
    let list = [...jobs];
    if (config?.featuredCategories && config.featuredCategories.length > 0) {
      const catSet = new Set(config.featuredCategories.map((c) => c.toLowerCase()));
      const filtered = list.filter((j) => catSet.has((j.subCategory || '').toLowerCase()));
      if (filtered.length > 0) list = filtered;
    }
    return list.slice(0, limit);
  }, [jobs, config?.featuredCategories, limit]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-5 border-b border-slate-200">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
            {config?.title || t('section.jobs')}
          </h2>
          {config?.description && (
            <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
          )}
        </div>
        <NavLink
          to="/jobs" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1 whitespace-nowrap">
          <span>{t('section.jobs.cta')}</span>
          <ArrowRight size={14} />
        </NavLink>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse"/>
          ))}
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="bg-[#F1F5F9] rounded-2xl p-8 text-center border border-slate-200/70">
          <p className="text-sm font-semibold text-[#102B4E]">No active job vacancies listed right now.</p>
          <p className="text-xs text-slate-500 mt-1">New verified job openings will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayedJobs.map((job) => {
            const detailPath = getOpportunityRoutePath(job);
            return (
              <article
                key={job.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 hover:border-[#14B8A6] hover:shadow-md transition-all flex items-center justify-between gap-3 group">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
                    {job.organizationLogo ? (
                      <img
                        src={job.organizationLogo}
                        alt={job.organization}
                        loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Briefcase size={22} className="text-[#083D91]"/>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-bold text-[#102B4E] group-hover:text-[#083D91] transition-colors line-clamp-2 sm:truncate">
                      <NavLink to={detailPath}>{job.title}</NavLink>
                    </h3>
                    <p className="text-xs font-semibold text-slate-600 flex items-center gap-1 truncate mt-0.5">
                      <Building2 size={12} className="text-slate-400 flex-shrink-0"/>
                      <span className="truncate">{job.organization}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} className="text-[#083D91]"/>
                        {job.location}
                      </span>
                      <span>·</span>
                      <span>{job.type || 'Full-time'}</span>
                      {job.subCategory && (
                        <>
                          <span>·</span>
                          <span className="text-[#14B8A6] font-semibold">{job.subCategory}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="font-semibold text-red-600">
                        {t('card.deadline')}: {safeFormatDate(job.deadline, 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {job.applyUrl && (
                    <a
                      href={job.applyUrl}
                      target="_blank" rel="noopener noreferrer" onClick={() => incrementCounter('opportunities', job.id, 'clicks')}
                      className="hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-[11px] font-bold transition-colors">
                      <span>{t('card.applyNow')}</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <NavLink
                    to={detailPath}
                    aria-label={`${t('card.viewDetails')}: ${job.title}`}
                    className="w-11 h-11 sm:w-9 sm:h-9 rounded-full bg-slate-50 group-hover:bg-[#083D91] text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                    <ChevronRight size={18} />
                  </NavLink>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
