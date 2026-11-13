import React from 'react';
import {
  ArrowRight,
  Building2,
  MapPin,
  Calendar,
  Briefcase,
  GraduationCap,
  ClipboardList,
  Star,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { HomepageSectionConfig, Opportunity } from '@/src/types';
import { useLanguage } from '@/src/lib/LanguageContext';
import { getOpportunityRoutePath } from '@/src/lib/publicData';
import { safeFormatDate } from '@/src/lib/utils';

const CATEGORY_ICON: Record<string, any> = {
  Jobs: Briefcase,
  Scholarships: GraduationCap,
  Tenders: ClipboardList,
  Others: Star,
};

interface FeaturedOpportunitiesProps {
  config?: HomepageSectionConfig;
  opportunities: Opportunity[];
  featuredIds?: string[];
  loading?: boolean;
}

export function FeaturedOpportunitiesSection({
  config,
  opportunities,
  featuredIds = [],
  loading,
}: FeaturedOpportunitiesProps) {
  const { t } = useLanguage();
  const limit = config?.limit || 4;
  const featuredIdSet = React.useMemo(() => new Set(featuredIds), [featuredIds]);

  const items = React.useMemo(() => {
    const selected = opportunities.filter(
      (opp) => opp.featured === true || featuredIdSet.has(opp.id)
    );
    return selected.slice(0, limit);
  }, [opportunities, featuredIdSet, limit]);

  return (
    <section className="bg-white py-10 md:py-14 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#102B4E]">
              {config?.title || t('section.featured')}
            </h2>
            {config?.description && (
              <p className="text-xs md:text-sm text-slate-500 mt-1">{config.description}</p>
            )}
          </div>
          <NavLink
            to="/opportunities" className="text-[#14B8A6] hover:text-[#0D9488] text-xs md:text-sm font-bold inline-flex items-center gap-1.5">
            <span>{t('section.featured.cta')}</span>
            <ArrowRight size={15} />
          </NavLink>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-slate-100 animate-pulse"/>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-[#F1F5F9] rounded-2xl p-8 text-center border border-slate-200/80">
            <p className="text-sm font-semibold text-[#102B4E] mb-2">
              No featured opportunities are currently selected.
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Administrators can feature active, non-expired listings from Website Management → Homepage.
            </p>
            <NavLink
              to="/opportunities" className="inline-flex items-center gap-1.5 bg-[#083D91] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#07366D] transition-colors">
              {t('section.featured.cta')} <ArrowRight size={14} />
            </NavLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((opp) => {
              const Icon = CATEGORY_ICON[opp.category] || Star;
              const targetPath = getOpportunityRoutePath(opp);
              return (
                <article
                  key={opp.id}
                  className="min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-lg hover:border-[#14B8A6]/60 transition-all flex flex-col justify-between">
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 flex-shrink-0 overflow-hidden">
                        {opp.organizationLogo ? (
                          <img
                            src={opp.organizationLogo}
                            alt={opp.organization}
                            loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-contain" onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Icon size={22} className="text-[#083D91]"/>
                        )}
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#14B8A6] text-right">
                        {opp.subCategory || opp.category}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#102B4E] leading-snug mb-3 line-clamp-2">
                      <NavLink to={targetPath} className="hover:text-[#083D91] transition-colors">
                        {opp.title}
                      </NavLink>
                    </h3>

                    <dl className="space-y-1.5 text-xs text-slate-600 mb-5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 size={13} className="text-[#083D91] flex-shrink-0"/>
                        <dd className="font-semibold text-[#102B4E] truncate">{opp.organization}</dd>
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={13} className="text-slate-400 flex-shrink-0"/>
                        <dd className="truncate">{opp.location || 'Rwanda'}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-slate-400 flex-shrink-0"/>
                        <dd className="font-medium">
                          {t('card.deadline')}: {safeFormatDate(opp.deadline, 'dd MMM yyyy')}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <NavLink
                    to={targetPath}
                    className="min-h-[44px] w-full bg-[#083D91] hover:bg-[#07366D] text-white py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors">
                    <span>{t('card.viewDetails')}</span>
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
