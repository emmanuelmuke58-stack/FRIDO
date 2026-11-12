import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Newspaper, Briefcase, GraduationCap, ClipboardList, Star } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

import { useSettings } from '@/src/lib/SettingsContext';

export function Hero() {
  const { settings } = useSettings();
  const slides = settings.heroSlides.length > 0 ? settings.heroSlides : [
    {
      category: 'Rwanda News (Kinyarwanda)',
      title: "U Rwanda rukomeje kwagura ubukungu n'ishoramari",
      description: "Leta y'u Rwanda yemeje ingamba nshya zo kongera ishoramari, guteza imbere ibikorwa remezo n'imirimo ishyigikira iterambere ry'igihugu.",
      buttonText: 'Soma amakuru',
      image: '/src/assets/images/kigali_panorama_hero_1794481092206.jpg',
      link: '/news'
    }
  ];
  
  const [current, setCurrent] = React.useState(0);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length);

  React.useEffect(() => {
    const timer = setInterval(nextSlide, 8000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <section className="relative h-[450px] md:h-[550px] lg:h-[600px] overflow-hidden bg-slate-900">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img
            src={slides[current].image}
            alt={slides[current].title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/80 via-black/40 md:via-black/20 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-end md:justify-center pb-16 md:pb-0 text-white">
        <motion.div
          key={`content-${current}`}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl"
        >
          <span className="inline-flex items-center bg-[#14B8A6] text-white text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold px-3 py-1.5 mb-4 rounded-sm shadow-lg shadow-teal-900/10">
            {slides[current].category}
          </span>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-montserrat leading-tight mb-4 drop-shadow-2xl">
            {slides[current].title}
          </h1>
          <p className="text-sm md:text-lg text-white/90 mb-8 max-w-xl font-inter leading-relaxed opacity-90">
            {slides[current].description}
          </p>
          <div className="flex gap-4">
            <NavLink to={slides[current].link || '#'} className="bg-[#14B8A6] hover:bg-[#0D9488] text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all transform active:scale-95 shadow-xl shadow-teal-900/30 group text-sm">
              {slides[current].buttonText}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </NavLink>
          </div>
        </motion.div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-12 left-4 md:left-auto md:right-12 flex items-center gap-8 z-20">
        <div className="flex gap-3">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                current === idx ? "bg-[#14B8A6] w-12" : "bg-white/30 w-3 hover:bg-white/60"
              )}
            />
          ))}
        </div>
        <div className="hidden md:flex gap-2">
          <button
            onClick={prevSlide}
            className="p-3 rounded-full border border-white/20 hover:bg-white/10 text-white transition-all backdrop-blur-sm"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextSlide}
            className="p-3 rounded-full border border-white/20 hover:bg-white/10 text-white transition-all backdrop-blur-sm"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

const CATEGORIES = [
  { icon: Newspaper, name: 'News', desc: 'Latest news from Rwanda in Kinyarwanda.', link: 'Soma amakuru →', path: '/news' },
  { icon: Briefcase, name: 'Jobs', desc: 'Find verified job vacancies in Rwanda and abroad.', link: 'View jobs →', path: '/jobs' },
  { icon: GraduationCap, name: 'Scholarships', desc: 'Study opportunities locally and internationally.', link: 'View scholarships →', path: '/scholarships' },
  { icon: ClipboardList, name: 'Tenders', desc: 'Government tenders and business opportunities.', link: 'View tenders →', path: '/tenders' },
  { icon: Star, name: 'Other Opportunities', desc: 'Training, grants, internships and more.', link: 'Explore →', path: '/opportunities' },
];

export function CategoryCards() {
  return (
    <section className="bg-white py-12 md:py-20 px-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {CATEGORIES.map((cat, idx) => (
          <motion.div
            key={cat.name}
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: idx * 0.1, duration: 0.6 }}
            className="group p-6 md:p-10 rounded-2xl bg-white border border-slate-100 hover:border-teal-100 hover:shadow-[0_20px_50px_rgba(20,184,166,0.12)] transition-all flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-transparent group-hover:bg-[#14B8A6] transition-colors" />
            <div className="w-14 h-14 md:w-16 md:h-16 bg-[#083D91] rounded-2xl flex items-center justify-center text-white mb-6 md:mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-lg shadow-blue-900/15">
              <cat.icon size={28} />
            </div>
            <h3 className="text-lg md:text-xl font-extrabold text-[#102B4E] mb-3 md:mb-4 font-montserrat tracking-tight">{cat.name}</h3>
            <p className="text-xs md:text-sm text-slate-500 mb-6 md:mb-8 font-inter leading-relaxed px-1 opacity-80">
              {cat.desc}
            </p>
            <NavLink to={cat.path} className="text-[#14B8A6] font-extrabold text-[10px] md:text-xs uppercase tracking-[0.15em] hover:underline flex items-center gap-2 mt-auto group-hover:gap-3 transition-all">
              {cat.link}
            </NavLink>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
