import React from 'react';
import { Hero, CategoryCards } from '@/src/components/home/Hero';
import { MainContent, PromotionalBanner } from '@/src/components/home/Content';

export function HomePage() {
  return (
    <div className="bg-white">
      <Hero />
      <CategoryCards />
      <MainContent />
      <PromotionalBanner />
      
      {/* Why This Design Works section - similar to the one in reference */}
      <section className="bg-slate-50 py-12 md:py-20 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl md:text-3xl font-bold text-[#102B4E] font-montserrat mb-6 md:mb-8">Why This Design Works</h2>
            <ul className="space-y-4 md:space-y-6">
              {[
                "Professional and trustworthy look with clean, modern layout.",
                "Easy navigation with clear categories and icons.",
                "Kinyarwanda news for local readers and English opportunities for global reach.",
                "Mobile-friendly design for all devices.",
                "Strong brand identity with a meaningful logo and consistent colors."
              ].map((item, idx) => (
                <li key={idx} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full bg-teal-500 flex-shrink-0 flex items-center justify-center text-white mt-0.5">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check w-4 h-4"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <span className="text-slate-700 font-medium text-sm md:text-base leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 lg:order-2 relative group overflow-hidden rounded-2xl shadow-xl md:shadow-2xl h-[300px] md:h-[400px] lg:h-full min-h-[300px]">
            <img 
              src="/src/assets/images/kigali_panorama_hero_1794481092206.jpg" 
              alt="Design Feature" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#083D91]/70 via-[#083D91]/20 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-8">
              <p className="text-2xl md:text-3xl font-bold text-white italic font-montserrat leading-tight">
                "More opportunities. <br className="hidden md:block" />A stronger Rwanda."
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
