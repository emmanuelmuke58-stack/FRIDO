import React from 'react';
import { ArrowRight, GraduationCap, Gavel } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '@/src/lib/SettingsContext';
import { STATIC_ASSETS, resolveAssetUrl } from '@/src/lib/assets';

export function PromoSpotlightCards() {
  const { settings } = useSettings();
  const education = settings.homepage?.promoBanners?.education;
  const tenders = settings.homepage?.promoBanners?.tenders;

  return (
    <section className="bg-white py-8 md:py-10 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Education Promo Card */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-[#F1F5F9] shadow-sm hover:shadow-md transition-all grid grid-cols-1 sm:grid-cols-12 items-stretch">
          <div className="sm:col-span-7 p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#083D91]/10 text-[#083D91] flex items-center justify-center mb-3">
                <GraduationCap size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#102B4E] mb-1.5">
                {education?.title || 'Invest in Your Education'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                {education?.description || 'Explore verified local and international scholarships for your academic journey.'}
              </p>
            </div>
            <NavLink
              to={education?.link || '/scholarships'}
              className="text-xs font-bold text-[#083D91] hover:text-[#14B8A6] inline-flex items-center gap-1.5 transition-colors">
              <span>{education?.buttonText || 'View Scholarships'}</span>
              <ArrowRight size={14} />
            </NavLink>
          </div>
          <div className="sm:col-span-5 min-h-[160px] bg-slate-200 overflow-hidden">
            <img
              src={resolveAssetUrl(education?.image, STATIC_ASSETS.rwandaGraduation)}
              alt={education?.title || 'Scholarships'}
              loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaGraduation;
              }}
            />
          </div>
        </div>

        {/* Tenders Promo Card */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/80 bg-[#F1F5F9] shadow-sm hover:shadow-md transition-all grid grid-cols-1 sm:grid-cols-12 items-stretch">
          <div className="sm:col-span-7 p-6 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-[#14B8A6] flex items-center justify-center mb-3">
                <Gavel size={20} />
              </div>
              <h3 className="text-lg font-bold text-[#102B4E] mb-1.5">
                {tenders?.title || 'Latest Tenders & Business Opportunities'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-4">
                {tenders?.description || 'Discover new tenders and business opportunities across Rwanda.'}
              </p>
            </div>
            <NavLink
              to={tenders?.link || '/tenders'}
              className="text-xs font-bold text-[#083D91] hover:text-[#14B8A6] inline-flex items-center gap-1.5 transition-colors">
              <span>{tenders?.buttonText || 'View Tenders'}</span>
              <ArrowRight size={14} />
            </NavLink>
          </div>
          <div className="sm:col-span-5 min-h-[160px] bg-slate-200 overflow-hidden">
            <img
              src={resolveAssetUrl(tenders?.image, STATIC_ASSETS.rwandaInfrastructure)}
              alt={tenders?.title || 'Tenders'}
              loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaInfrastructure;
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PromotionalBanner() {
  const { settings } = useSettings();
  const cta = settings.homepage?.promoBanners?.cta;

  return (
    <section className="px-4 sm:px-6 py-8 md:py-12 bg-white">
      <div className="max-w-7xl mx-auto relative rounded-3xl overflow-hidden shadow-xl">
        <img
          src={resolveAssetUrl(cta?.image, STATIC_ASSETS.rwandaEducationBanner)}
          alt={cta?.title || 'Explore Opportunities'}
          loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.rwandaEducationBanner;
          }}
        />
        <div className="relative z-10 min-h-[250px] md:min-h-[300px] bg-gradient-to-r from-[#07366D]/95 via-[#083D91]/85 to-[#083D91]/45 flex items-center">
          <div className="p-6 sm:p-10 md:p-14 max-w-2xl text-white">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 leading-tight">
              {cta?.title || 'Your Future Starts With the Right Opportunity.'}
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-white/90 mb-6 leading-relaxed">
              {cta?.description ||
                'Find verified jobs, scholarships, tenders, and opportunities in Rwanda and beyond.'}
            </p>
            <NavLink
              to={cta?.link || '/opportunities'}
              className="min-h-[44px] bg-[#14B8A6] hover:bg-[#0D9488] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 inline-flex items-center gap-2 text-xs sm:text-sm">
              <span>{cta?.buttonText || 'Explore Opportunities'}</span>
              <ArrowRight size={16} />
            </NavLink>
          </div>
        </div>
      </div>
    </section>
  );
}
