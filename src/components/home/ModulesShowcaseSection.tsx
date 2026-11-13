import React from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Download,
  FileText,
  Globe,
  GraduationCap,
  MapPin,
  Star,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { HomepageSectionConfig, Opportunity } from '@/src/types';
import { useLanguage } from '@/src/lib/LanguageContext';
import { getOpportunityRoutePath } from '@/src/lib/publicData';
import { incrementCounter } from '@/src/lib/services';
import { safeFormatDate } from '@/src/lib/utils';

function filterBySectionCats(items: Opportunity[], config?: HomepageSectionConfig): Opportunity[] {
  const limit = config?.limit || 4;
  let list = [...items];
  if (config?.featuredCategories && config.featuredCategories.length > 0) {
    const catSet = new Set(config.featuredCategories.map((c) => c.toLowerCase()));
    const filtered = list.filter((o) => catSet.has((o.subCategory || '').toLowerCase()));
    if (filtered.length > 0) list = filtered;
  }
  return list.slice(0, limit);
}

export function ScholarshipsSection({
  config,
  scholarships,
  loading,
}: {
  config?: HomepageSectionConfig;
  scholarships: Opportunity[];
  loading?: boolean;
}) {
  const { t } = useLanguage();
  const items = React.useMemo(() => filterBySectionCats(scholarships, config), [scholarships, config]);

  return (
    <section className="bg-[#F1F5F9]/70 py-10 md:py-12 px-4 sm:px-6 border-t border-slate-200/60">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
              {config?.title || t('section.scholarships')}
            </h2>
            {config?.description && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">{config.description}</p>
            )}
          </div>
          <NavLink
            to="/scholarships" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1.5">
            <span>{t('section.scholarships.cta')}</span>
            <ArrowRight size={15} />
          </NavLink>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-white animate-pulse"/>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
            <p className="text-sm font-semibold text-[#102B4E]">No active scholarships listed at the moment.</p>
            <p className="text-xs text-slate-500 mt-1">Expired or unpublished scholarships are excluded automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((sch) => {
              const path = getOpportunityRoutePath(sch);
              return (
                <article
                  key={sch.id}
                  className="min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-[#14B8A6] transition-all flex flex-col justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#14B8A6] flex items-center justify-center flex-shrink-0">
                        <GraduationCap size={20} />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] text-right">
                        {sch.subCategory || sch.type || 'Scholarship'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#102B4E] line-clamp-2 mb-2.5">
                      <NavLink to={path} className="hover:text-[#083D91] transition-colors">
                        {sch.title}
                      </NavLink>
                    </h3>
                    <dl className="space-y-1.5 text-xs text-slate-600 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={13} className="text-[#083D91] flex-shrink-0"/>
                        <dd className="font-semibold truncate">{sch.institution || sch.organization}</dd>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe size={13} className="text-slate-400 flex-shrink-0"/>
                        <dd className="truncate">{sch.country || sch.location}</dd>
                      </div>
                      {(sch.scholarshipType || sch.salary) && (
                        <div className="text-[11px] font-semibold text-teal-700 truncate">
                          {sch.scholarshipType || sch.salary}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-red-600 font-semibold">
                        <Clock size={12} className="flex-shrink-0"/>
                        <dd>
                          {t('card.deadline')}: {safeFormatDate(sch.deadline, 'dd MMM yyyy')}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <NavLink
                    to={path}
                    className="min-h-[44px] w-full bg-[#083D91] hover:bg-[#07366D] text-white py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors">
                    <span>{t('card.viewScholarship')}</span>
                    <ArrowRight size={14} />
                  </NavLink>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function TendersSection({
  config,
  tenders,
  loading,
}: {
  config?: HomepageSectionConfig;
  tenders: Opportunity[];
  loading?: boolean;
}) {
  const { t } = useLanguage();
  const items = React.useMemo(() => filterBySectionCats(tenders, config), [tenders, config]);

  return (
    <section className="bg-white py-10 md:py-12 px-4 sm:px-6 border-t border-slate-100">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
              {config?.title || t('section.tenders')}
            </h2>
            {config?.description && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">{config.description}</p>
            )}
          </div>
          <NavLink
            to="/tenders" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1.5">
            <span>{t('section.tenders.cta')}</span>
            <ArrowRight size={15} />
          </NavLink>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse"/>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#F1F5F9] rounded-2xl p-8 text-center border border-slate-200/80">
            <p className="text-sm font-semibold text-[#102B4E]">No open tenders listed right now.</p>
            <p className="text-xs text-slate-500 mt-1">Active procurement notices will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {items.map((tender) => {
              const path = getOpportunityRoutePath(tender);
              return (
                <article
                  key={tender.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-[#083D91]/40 transition-all flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#083D91]">
                        {tender.subCategory || 'Tender'}
                      </span>
                      {tender.tenderRef && (
                        <span className="text-[11px] font-mono font-semibold text-slate-500 inline-flex items-center gap-1">
                          <FileText size={11} /> Ref: {tender.tenderRef}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#102B4E] mb-2 line-clamp-2">
                      <NavLink to={path} className="hover:text-[#083D91] transition-colors">
                        {tender.title}
                      </NavLink>
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <span className="font-semibold inline-flex items-center gap-1.5">
                        <Building2 size={13} className="text-[#083D91]"/>
                        {tender.issuingOrg || tender.organization}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Calendar size={12} />
                        {t('card.published')}: {safeFormatDate(tender.createdAt, 'dd MMM yyyy')}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                        <Clock size={12} />
                        {t('card.deadline')}: {safeFormatDate(tender.deadline, 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100">
                    <NavLink
                      to={path}
                      className="min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors">
                      <span>{t('card.viewTender')}</span>
                      <ArrowRight size={13} />
                    </NavLink>
                    {tender.downloadUrl && (
                      <a
                        href={tender.downloadUrl}
                        target="_blank" rel="noopener noreferrer" onClick={() => incrementCounter('opportunities', tender.id, 'clicks')}
                        className="min-h-[44px] bg-slate-100 hover:bg-teal-50 text-[#102B4E] hover:text-teal-700 px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors">
                        <Download size={13} />
                        <span>{t('card.downloadDocs')}</span>
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function OtherOpportunitiesSection({
  config,
  others,
  loading,
}: {
  config?: HomepageSectionConfig;
  others: Opportunity[];
  loading?: boolean;
}) {
  const { t } = useLanguage();
  const items = React.useMemo(() => filterBySectionCats(others, config), [others, config]);

  return (
    <section className="bg-[#F1F5F9]/60 py-10 md:py-12 px-4 sm:px-6 border-t border-slate-200/60">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
              {config?.title || t('section.others')}
            </h2>
            {config?.description && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">{config.description}</p>
            )}
          </div>
          <NavLink
            to="/opportunities" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1.5">
            <span>{t('section.others.cta')}</span>
            <ArrowRight size={15} />
          </NavLink>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white animate-pulse"/>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
            <p className="text-sm font-semibold text-[#102B4E]">
              No active internships, grants, fellowships, or workshops right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((item) => {
              const path = getOpportunityRoutePath(item);
              return (
                <article
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md hover:border-[#14B8A6] transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#083D91] flex items-center justify-center flex-shrink-0">
                        <Star size={18} />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6]">
                        {item.subCategory || item.type || 'Opportunity'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#102B4E] line-clamp-2 mb-2">
                      <NavLink to={path} className="hover:text-[#083D91] transition-colors">
                        {item.title}
                      </NavLink>
                    </h3>
                    <div className="space-y-1 text-xs text-slate-600 mb-4">
                      <div className="font-semibold truncate">{item.organization}</div>
                      <div className="flex items-center gap-1 text-slate-500">
                        <MapPin size={12} /> {item.location}
                      </div>
                      <div className="text-red-600 font-semibold">
                        {t('card.deadline')}: {safeFormatDate(item.deadline, 'dd MMM yyyy')}
                      </div>
                    </div>
                  </div>
                  <NavLink
                    to={path}
                    className="text-xs font-bold text-[#083D91] hover:text-[#14B8A6] inline-flex items-center gap-1.5">
                    <span>{t('card.viewDetails')}</span>
                    <ArrowRight size={13} />
                  </NavLink>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
