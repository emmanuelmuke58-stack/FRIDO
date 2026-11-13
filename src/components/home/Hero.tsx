import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  Briefcase,
  GraduationCap,
  ClipboardList,
  Star,
  Calendar,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn, safeFormatDate } from '@/src/lib/utils';
import { useSettings } from '@/src/lib/SettingsContext';
import { useLanguage } from '@/src/lib/LanguageContext';
import { STATIC_ASSETS, resolveAssetUrl } from '@/src/lib/assets';
import { PublicCounts } from '@/src/lib/publicData';

export function Hero() {
  const { settings } = useSettings();
  const { t } = useLanguage();

  const publishedSlides = React.useMemo(() => {
    const active = (settings.heroSlides || [])
      .filter((s) => s.status !== 'draft')
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return active;
  }, [settings.heroSlides]);

  const [current, setCurrent] = React.useState(0);

  React.useEffect(() => {
    if (current >= publishedSlides.length) {
      setCurrent(0);
    }
  }, [publishedSlides.length, current]);

  const nextSlide = React.useCallback(() => {
    if (publishedSlides.length <= 1) return;
    setCurrent((prev) => (prev + 1) % publishedSlides.length);
  }, [publishedSlides.length]);

  const prevSlide = React.useCallback(() => {
    if (publishedSlides.length <= 1) return;
    setCurrent((prev) => (prev - 1 + publishedSlides.length) % publishedSlides.length);
  }, [publishedSlides.length]);

  React.useEffect(() => {
    if (publishedSlides.length <= 1) return;
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [publishedSlides.length, nextSlide]);

  if (publishedSlides.length === 0) {
    return (
      <section className="relative min-h-[380px] md:min-h-[460px] overflow-hidden bg-[#083D91]">
        <img
          src={STATIC_ASSETS.kigaliPanoramaHero}
          alt={settings.websiteName}
          className="absolute inset-0 w-full h-full object-cover opacity-35"/>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-white flex flex-col justify-center min-h-[380px] md:min-h-[460px]">
          <div className="max-w-2xl">
            <span className="inline-block bg-[#14B8A6] text-white text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1 rounded mb-4">
              {settings.websiteName}
            </span>
            <h1 className="text-[28px] sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
              {settings.seo.defaultTitle}
            </h1>
            <p className="text-sm md:text-lg text-white/90 mb-8 max-w-xl leading-relaxed">
              {settings.seo.defaultDescription}
            </p>
            <div className="flex flex-wrap gap-3">
              <NavLink
                to="/opportunities" className="bg-[#14B8A6] hover:bg-[#0D9488] text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 text-sm transition-colors">
                {t('nav.opportunities')} <ArrowRight size={17} />
              </NavLink>
              <NavLink
                to="/news" className="bg-white/10 hover:bg-white/20 border border-white/25 text-white px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 text-sm transition-colors">
                {t('nav.news')} <ArrowRight size={17} />
              </NavLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const activeSlide = publishedSlides[current] || publishedSlides[0];

  return (
    <section className="relative min-h-[420px] sm:min-h-[470px] md:h-[520px] lg:h-[560px] overflow-hidden bg-slate-900 flex">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide.id || current}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut'}}
          className="absolute inset-0">
          <img
            src={resolveAssetUrl(activeSlide.image, STATIC_ASSETS.kigaliPanoramaHero)}
            alt={activeSlide.title}
            className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = STATIC_ASSETS.kigaliPanoramaHero;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#071D44]/90 via-[#071D44]/60 to-transparent"/>
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 flex flex-col justify-end md:justify-center pt-12 pb-16 sm:pb-16 md:py-0 text-white">
        <motion.div
          key={`slide-content-${activeSlide.id || current}`}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.55, ease: 'easeOut'}}
          className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {activeSlide.category && (
              <span className="inline-flex items-center bg-[#14B8A6] text-white text-[10px] uppercase tracking-[0.16em] font-bold px-3 py-1 rounded">
                {activeSlide.category}
              </span>
            )}
            {activeSlide.publishedAt && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80">
                <Calendar size={12} className="text-[#14B8A6]"/>
                {safeFormatDate(activeSlide.publishedAt, 'MMM dd, yyyy', '')}
              </span>
            )}
          </div>

          <h1 className="text-[26px] sm:text-4xl md:text-5xl lg:text-[54px] font-bold leading-[1.12] mb-3.5 drop-shadow-lg">
            {activeSlide.title}
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-white/90 mb-5 sm:mb-6 md:mb-8 max-w-xl leading-relaxed line-clamp-3">
            {activeSlide.description}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <NavLink
              to={activeSlide.link || '/opportunities'}
              className="min-h-[44px] bg-[#14B8A6] hover:bg-[#0D9488] text-white px-5 sm:px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-teal-950/30 text-xs sm:text-sm">
              <span>{activeSlide.buttonText || 'Explore'}</span>
              <ArrowRight size={17} />
            </NavLink>

            {activeSlide.secondaryButtonText && activeSlide.secondaryLink && (
              <NavLink
                to={activeSlide.secondaryLink}
                className="min-h-[44px] bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white px-5 sm:px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2 transition-all active:scale-95 text-xs sm:text-sm">
                <span>{activeSlide.secondaryButtonText}</span>
                <ArrowRight size={17} />
              </NavLink>
            )}
          </div>
        </motion.div>
      </div>

      {/* Left/Right Desktop Arrows */}
      {publishedSlides.length > 1 && (
        <>
          <button
            type="button" onClick={prevSlide}
            aria-label="Previous slide" className="hidden md:flex absolute left-4 lg:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#083D91] items-center justify-center shadow-lg transition-all cursor-pointer">
            <ChevronLeft size={20} />
          </button>
          <button
            type="button" onClick={nextSlide}
            aria-label="Next slide" className="hidden md:flex absolute right-4 lg:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-[#083D91] items-center justify-center shadow-lg transition-all cursor-pointer">
            <ChevronRight size={20} />
          </button>

          {/* Carousel Dots */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-20">
            {publishedSlides.map((slide, idx) => (
              <button
                key={slide.id || idx}
                type="button" onClick={() => setCurrent(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={cn(
                  'h-2.5 rounded-full transition-all duration-300 cursor-pointer',
                  current === idx ? 'bg-[#14B8A6] w-7': 'bg-white/50 w-2.5 hover:bg-white/80')}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface CategoryCardsProps {
  counts: PublicCounts;
  loading?: boolean;
}

export function CategoryCards({ counts, loading }: CategoryCardsProps) {
  const { t } = useLanguage();

  const cards = [
    {
      icon: Newspaper,
      name: t('cat.news.title'),
      desc: t('cat.news.desc'),
      cta: t('cat.news.cta'),
      path: '/news',
      count: counts.news,
      unit: counts.news === 1 ? 'Article': 'Articles',
    },
    {
      icon: Briefcase,
      name: t('cat.jobs.title'),
      desc: t('cat.jobs.desc'),
      cta: t('cat.jobs.cta'),
      path: '/jobs',
      count: counts.jobs,
      unit: counts.jobs === 1 ? 'Active Job': 'Active Jobs',
    },
    {
      icon: GraduationCap,
      name: t('cat.scholarships.title'),
      desc: t('cat.scholarships.desc'),
      cta: t('cat.scholarships.cta'),
      path: '/scholarships',
      count: counts.scholarships,
      unit: counts.scholarships === 1 ? 'Active Program': 'Active Programs',
    },
    {
      icon: ClipboardList,
      name: t('cat.tenders.title'),
      desc: t('cat.tenders.desc'),
      cta: t('cat.tenders.cta'),
      path: '/tenders',
      count: counts.tenders,
      unit: counts.tenders === 1 ? 'Open Tender': 'Open Tenders',
    },
    {
      icon: Star,
      name: t('cat.others.title'),
      desc: t('cat.others.desc'),
      cta: t('cat.others.cta'),
      path: '/opportunities',
      count: counts.others,
      unit: counts.others === 1 ? 'Listing': 'Listings',
    },
  ];

  return (
    <section className="bg-white py-10 md:py-14 px-4 sm:px-6 border-b border-slate-100">
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
        {cards.map((cat) => (
          <NavLink
            key={cat.path}
            to={cat.path}
            className="group p-5 md:p-6 rounded-2xl bg-white border border-slate-200/80 hover:border-[#14B8A6] shadow-sm hover:shadow-[0_14px_34px_rgba(8,61,145,0.08)] transition-all flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-transparent group-hover:bg-[#14B8A6] transition-colors"/>
            <div className="w-12 h-12 md:w-14 md:h-14 bg-[#083D91] rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-105 transition-transform shadow-md shadow-blue-900/15">
              <cat.icon size={24} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-[#102B4E] mb-1.5 tracking-tight uppercase">
              {cat.name}
            </h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed line-clamp-2">
              {cat.desc}
            </p>
            <div className="text-xs font-bold text-[#083D91] mb-3 tabular-nums">
              {loading ? '...': `${cat.count} ${cat.unit}`}
            </div>
            <span className="text-[#14B8A6] font-bold text-xs tracking-wide inline-flex items-center gap-1.5 mt-auto group-hover:gap-2.5 transition-all">
              {cat.cta} <ArrowRight size={14} />
            </span>
          </NavLink>
        ))}
      </div>
    </section>
  );
}
