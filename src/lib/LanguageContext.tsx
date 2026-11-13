import React, { createContext, useContext, useState, useEffect } from 'react';

export type SiteLanguage = 'English'| 'Kinyarwanda';

const STORAGE_KEY = 'rw_site_language';

const TRANSLATIONS: Record<SiteLanguage, Record<string, string>> = {
  English: {
    'nav.home': 'Home',
    'nav.news': 'News',
    'nav.jobs': 'Jobs',
    'nav.scholarships': 'Scholarships',
    'nav.tenders': 'Tenders',
    'nav.opportunities': 'Opportunities',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.search': 'Search',
    'nav.menu': 'Menu',
    'nav.more': 'More',
    'cat.news.title': 'News',
    'cat.news.desc': 'Latest verified news and updates across Rwanda.',
    'cat.news.cta': 'Read News',
    'cat.jobs.title': 'Jobs',
    'cat.jobs.desc': 'Find verified job vacancies locally and abroad.',
    'cat.jobs.cta': 'View Jobs',
    'cat.scholarships.title': 'Scholarships',
    'cat.scholarships.desc': 'Discover educational funding and study opportunities.',
    'cat.scholarships.cta': 'View Scholarships',
    'cat.tenders.title': 'Tenders',
    'cat.tenders.desc': 'Explore government and private-sector procurement tenders.',
    'cat.tenders.cta': 'View Tenders',
    'cat.others.title': 'Other Opportunities',
    'cat.others.desc': 'Internships, grants, fellowships, training and more.',
    'cat.others.cta': 'Explore',
    'section.featured': 'Featured Opportunities',
    'section.featured.cta': 'View All Opportunities',
    'section.news': 'Latest News from Rwanda',
    'section.news.cta': 'View All News',
    'section.jobs': 'Find Your Next Career Opportunity',
    'section.jobs.cta': 'View All Jobs',
    'section.scholarships': 'Latest Scholarships & Study Programs',
    'section.scholarships.cta': 'View All Scholarships',
    'section.tenders': 'Latest Tenders & Business Notices',
    'section.tenders.cta': 'View All Tenders',
    'section.others': 'Internships, Fellowships & Grants',
    'section.others.cta': 'Explore All',
    'search.heading': 'Search Verified News & Active Opportunities',
    'search.placeholder': 'Search jobs, scholarships, tenders, news, organizations...',
    'search.button': 'Search',
    'search.allTypes': 'All Content',
    'search.allCategories': 'All Categories',
    'search.allLocations': 'All Locations',
    'search.allLanguages': 'All Languages',
    'search.sortNewest': 'Newest First',
    'search.sortDeadline': 'Closing Soonest',
    'search.clear': 'Clear Filters',
    'search.resultsCount': 'matching results found',
    'search.noResults': 'No published articles or active opportunities match your filters.',
    'card.deadline': 'Deadline',
    'card.published': 'Published',
    'card.viewDetails': 'View Details',
    'card.applyNow': 'Apply Now',
    'card.viewScholarship': 'View Scholarship',
    'card.viewTender': 'View Tender Details',
    'card.downloadDocs': 'Download Documents',
    'card.readFull': 'Read Full Article',
    'card.minRead': 'min read',
    'newsletter.title': 'Never Miss an Opportunity.',
    'newsletter.subtitle': 'Get verified news, jobs, scholarships, and tenders delivered directly to your inbox.',
    'newsletter.placeholder': 'Your email address...',
    'newsletter.subscribe': 'Subscribe',
    'newsletter.unsubscribe': 'Unsubscribe',
    'newsletter.consent': 'By subscribing, you agree to receive opportunity alerts and accept our Privacy Policy.',
    'footer.quickLinks': 'Quick Links',
    'footer.aboutUs': 'About Us',
    'footer.contactNewsletter': 'Contact & Info',
    'footer.rights': 'All rights reserved.',
    'footer.privacy': 'Privacy Policy',
    'footer.terms': 'Terms of Use',
    'news.title': 'Rwanda Newsroom',
    'news.subtitle': 'Verified national reporting, policy updates, economy, and technology stories across Rwanda.',
    'news.allNews': 'All News',
    'news.searchPlaceholder': 'Search headlines, topics, or authors...',
    'news.articlesPublished': 'articles published',
    'news.articlePublished': 'article published',
    'news.sortNewest': 'Newest First',
    'news.sortMostRead': 'Most Read',
    'news.leadStory': 'Lead Story',
    'news.backToNews': 'Back to All News',
    'news.relatedTitle': 'Related Articles',
    'news.latestTitle': 'Latest Stories',
    'news.readAllTitle': 'Explore All Rwanda News',
    'news.readAllDesc': 'Browse every verified Kinyarwanda and English report.',
    'news.prevArticle': 'Previous Article',
    'news.nextArticle': 'Next Article',
    'news.share': 'Share article',
    'news.copied': 'Link copied',
    'news.copyLink': 'Copy link',
    'news.print': 'Print',
    'news.scrollTop': 'Back to Top',
    'news.notFoundTitle': 'Article Not Found',
    'news.notFoundDesc': 'This article may have been unpublished, moved, or deleted.',
    'news.emptyFiltered': 'No published articles match your selected filters or search.',
    'news.emptyAll': 'No published news articles are available yet.',
    'news.resetFilters': 'Reset Filters',
    'news.by': 'By',
    'news.views': 'views',
    'news.topics': 'Topics',
  },
  Kinyarwanda: {
    'nav.home': 'Ahabanza',
    'nav.news': 'Amakuru',
    'nav.jobs': 'Imirimo',
    'nav.scholarships': 'Buruse',
    'nav.tenders': 'Amasoko',
    'nav.opportunities': 'Amahirwe',
    'nav.about': 'Tumenye',
    'nav.contact': 'Twandikire',
    'nav.search': 'Shakisha',
    'nav.menu': 'Ibikubiyemo',
    'nav.more': 'Ibindi',
    'cat.news.title': 'Amakuru',
    'cat.news.desc': 'Amakuru agezweho kandi yizewe yo mu Rwanda.',
    'cat.news.cta': 'Soma amakuru',
    'cat.jobs.title': 'Imirimo',
    'cat.jobs.desc': 'Shaka imirimo yizewe mu Rwanda no mu mahanga.',
    'cat.jobs.cta': 'Reba imirimo',
    'cat.scholarships.title': 'Buruse',
    'cat.scholarships.desc': 'Amahirwe yo kwiga imbere mu gihugu no hanze.',
    'cat.scholarships.cta': 'Reba buruse',
    'cat.tenders.title': 'Amasoko',
    'cat.tenders.desc': 'Amasoko ya Leta n’ay’abikorera atangwa buri gihe.',
    'cat.tenders.cta': 'Reba amasoko',
    'cat.others.title': 'Andi Mahirwe',
    'cat.others.desc': 'Imenyerezamwuga, inkunga, amahugurwa n’ibindi.',
    'cat.others.cta': 'Menya byinshi',
    'section.featured': 'Amahirwe Yatoranyijwe',
    'section.featured.cta': 'Reba Amahirwe Yose',
    'section.news': 'Amakuru Agezweho mu Rwanda',
    'section.news.cta': 'Reba Amakuru Yose',
    'section.jobs': 'Shaka Umwanya w’Umurimo',
    'section.jobs.cta': 'Reba Imirimo Yose',
    'section.scholarships': 'Buruse n’Amahugurwa Agezweho',
    'section.scholarships.cta': 'Reba Buruse Zose',
    'section.tenders': 'Amasoko & Ibikorwa by’Ubucuruzi',
    'section.tenders.cta': 'Reba Amasoko Yose',
    'section.others': 'Imenyerezamwuga, Inkunga & Amahugurwa',
    'section.others.cta': 'Reba Yose',
    'search.heading': 'Shakisha Amakuru n’Amahirwe Akora',
    'search.placeholder': 'Shakisha akazi, buruse, isoko, amakuru, ikigo...',
    'search.button': 'Shakisha',
    'search.allTypes': 'Ibice Byose',
    'search.allCategories': 'Ibyiciro Byose',
    'search.allLocations': 'Ahantu Hose',
    'search.allLanguages': 'Indimi Zose',
    'search.sortNewest': 'Ibishya Banza',
    'search.sortDeadline': 'Ibigiye Kurangira',
    'search.clear': 'Siba Ibyatoranyijwe',
    'search.resultsCount': 'ibisubizo bibonetse',
    'search.noResults': 'Nta makuru cyangwa amahirwe ahuye n’ibyo washakishije.',
    'card.deadline': 'Itariki ntarengwa',
    'card.published': 'Yashyizweho',
    'card.viewDetails': 'Reba Ibisobanuro',
    'card.applyNow': 'Saba Ubu',
    'card.viewScholarship': 'Reba Buruse',
    'card.viewTender': 'Reba Iby’Isoko',
    'card.downloadDocs': 'Kuraho Inyandiko',
    'card.readFull': 'Soma Inkuru Yose',
    'card.minRead': 'min zo gusoma',
    'newsletter.title': 'Ntucikwe n’Amahirwe.',
    'newsletter.subtitle': 'Akira amakuru, imirimo, buruse n’amasoko bigezweho mu butumwa bwa imeyili.',
    'newsletter.placeholder': 'Andika imeyili yawe...',
    'newsletter.subscribe': 'Iyandikishe',
    'newsletter.unsubscribe': 'Hagarika kwakira',
    'newsletter.consent': 'Kwiyandikisha bivuze ko wemeye kwakira amakuru n’amahirwe hakurikijwe Politiki y’Ibanga.',
    'footer.quickLinks': 'Ihuza Ryihuse',
    'footer.aboutUs': 'Ibitwerekeye',
    'footer.contactNewsletter': 'Twandikire & Amakuru',
    'footer.rights': 'Uburenganzira bwose burarinzwe.',
    'footer.privacy': 'Politiki y’Ibanga',
    'footer.terms': 'Amategeko y’Ikoresha',
    'news.title': 'Ibiro by’Amakuru mu Rwanda',
    'news.subtitle': 'Amakuru yizewe ku bukungu, uburezi, ikoranabuhanga n’iterambere mu Rwanda no hanze.',
    'news.allNews': 'Amakuru Yose',
    'news.searchPlaceholder': 'Shakisha umutwe w’inkuru, insanganyamatsiko, cyangwa umwanditsi...',
    'news.articlesPublished': 'inkuru zasohotse',
    'news.articlePublished': 'inkuru yasohotse',
    'news.sortNewest': 'Izigezweho Banza',
    'news.sortMostRead': 'Izasomwe Cyane',
    'news.leadStory': 'Inkuru Nyamukuru',
    'news.backToNews': 'Subira ku Makuru Yose',
    'news.relatedTitle': 'Izindi Nkuru Zisomanye',
    'news.latestTitle': 'Inkuru Ziheruka',
    'news.readAllTitle': 'Soma Amakuru Yose',
    'news.readAllDesc': 'Reba inkuru zose zizewe mu Kinyarwanda n’Icyongereza.',
    'news.prevArticle': 'Inkuru Ibanziriza',
    'news.nextArticle': 'Inkuru Ikurikira',
    'news.share': 'Sangiza abandi',
    'news.copied': 'Ihuza ryakopwe',
    'news.copyLink': 'Koporora ihuza',
    'news.print': 'Sohora',
    'news.scrollTop': 'Subira Hejuru',
    'news.notFoundTitle': 'Inkuru Ntiyabonetse',
    'news.notFoundDesc': 'Iyi nkuru ishobora kuba itakigaragara, yarimuwe cyangwa yasibwe.',
    'news.emptyFiltered': 'Nta nkuru zihuye n’ibyo wahisemo cyangwa washakishije.',
    'news.emptyAll': 'Nta makuru arasohoka muri iki gihe.',
    'news.resetFilters': 'Subiramo Ibyatoranyijwe',
    'news.by': 'Yanditswe na',
    'news.views': 'basomye',
    'news.topics': 'Ingingo',
  },
};

interface LanguageContextValue {
  language: SiteLanguage;
  setLanguage: (lang: SiteLanguage) => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'English',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SiteLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'Kinyarwanda'? 'Kinyarwanda': 'English';
    } catch {
      return 'English';
    }
  });

  const setLanguage = (lang: SiteLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = language === 'Kinyarwanda'? 'rw': 'en';
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    return TRANSLATIONS[language][key] || TRANSLATIONS.English[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
