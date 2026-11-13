import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, MapPin, Calendar as CalendarIcon, X, Globe } from 'lucide-react';
import { Facebook, Twitter, Linkedin, Youtube } from '../ui/SocialIcons';
import { cn } from '@/src/lib/utils';
import { useSettings } from '@/src/lib/SettingsContext';
import { useLanguage } from '@/src/lib/LanguageContext';
import { fetchPublicPortalData, PUBLIC_DATA_UPDATED_EVENT } from '@/src/lib/publicData';
import { CategoryItem } from '@/src/types';

function formatTodayDate(lang: 'English'| 'Kinyarwanda'): string {
  const now = new Date();
  if (lang === 'Kinyarwanda') {
    const days = ['Ku Cyumweru', 'Kuwa Mbere', 'Kuwa Kabiri', 'Kuwa Gatatu', 'Kuwa Kane', 'Kuwa Gatanu', 'Kuwa Gatandatu'];
    const months = ['Mutarama', 'Gashyantare', 'Werurwe', 'Mata', 'Gicurasi', 'Kamena', 'Nyakanga', 'Kanama', 'Nzeli', 'Ukwakira', 'Ugushyingo', 'Ukuboza'];
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TopBar() {
  const { settings } = useSettings();
  const { language, setLanguage } = useLanguage();
  const [dateLabel, setDateLabel] = React.useState(() => formatTodayDate(language));

  React.useEffect(() => {
    setDateLabel(formatTodayDate(language));
    const interval = setInterval(() => {
      setDateLabel(formatTodayDate(language));
    }, 60_000);
    return () => clearInterval(interval);
  }, [language]);

  const socialItems = [
    { href: settings.socialLinks?.facebook, Icon: Facebook, label: 'Facebook'},
    { href: settings.socialLinks?.twitter, Icon: Twitter, label: 'X'},
    { href: settings.socialLinks?.linkedin, Icon: Linkedin, label: 'LinkedIn'},
    { href: settings.socialLinks?.youtube, Icon: Youtube, label: 'YouTube'},
  ].filter((s) => Boolean(s.href && s.href.trim() && s.href.trim() !== '#'));

  return (
    <div className="bg-[#083D91] text-white py-2 px-4 hidden md:block border-b border-white/10">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-xs gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-medium flex items-center gap-1.5 whitespace-nowrap">
            <CalendarIcon size={12} className="text-teal-300"/>
            {dateLabel}
          </span>
          <span className="opacity-30">|</span>
          <span className="flex items-center gap-1 opacity-90 truncate">
            <MapPin size={12} className="text-teal-300 flex-shrink-0"/>
            {settings.address || 'Kigali, Rwanda'}
          </span>
        </div>
        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="flex items-center gap-2" role="group" aria-label="Language Selector">
            <button
              type="button" onClick={() => setLanguage('Kinyarwanda')}
              className={cn(
                'transition-colors cursor-pointer px-1.5 py-0.5 rounded',
                language === 'Kinyarwanda'? 'text-[#14B8A6] font-bold underline underline-offset-4': 'text-white/80 hover:text-teal-300')}
            >
              Kinyarwanda
            </button>
            <span className="opacity-30">|</span>
            <button
              type="button" onClick={() => setLanguage('English')}
              className={cn(
                'transition-colors cursor-pointer px-1.5 py-0.5 rounded',
                language === 'English'? 'text-[#14B8A6] font-bold underline underline-offset-4': 'text-white/80 hover:text-teal-300')}
            >
              English
            </button>
          </div>
          {socialItems.length > 0 && (
            <div className="flex items-center gap-3.5">
              {socialItems.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="text-white/85 hover:text-[#14B8A6] transition-colors">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SubLink {
  name: string;
  path: string;
}

interface NavItem {
  key: string;
  name: string;
  path: string;
  matchPrefix?: string;
  subLinks?: SubLink[];
}

const DEFAULT_SUBLINKS: Record<string, SubLink[]> = {
  News: [
    { name: 'All News', path: '/news'},
    { name: 'Rwanda (Kinyarwanda)', path: '/news?lang=Kinyarwanda'},
    { name: 'Rwanda (English)', path: '/news?lang=English'},
    { name: 'Business', path: '/news/category/business'},
    { name: 'Economy', path: '/news/category/economy'},
    { name: 'Technology', path: '/news/category/technology'},
    { name: 'International', path: '/news/category/international'},
  ],
  Jobs: [
    { name: 'All Jobs', path: '/jobs'},
    { name: 'Government Jobs', path: '/jobs/category/government'},
    { name: 'Private Sector Jobs', path: '/jobs/category/private-sector'},
    { name: 'NGO Jobs', path: '/jobs/category/ngo'},
    { name: 'International Jobs', path: '/jobs/category/international'},
  ],
  Scholarships: [
    { name: 'All Scholarships', path: '/scholarships'},
    { name: 'Local Scholarships', path: '/scholarships/category/local'},
    { name: 'International Scholarships', path: '/scholarships/category/international'},
    { name: 'Undergraduate', path: '/scholarships/category/undergraduate'},
    { name: "Master's", path: '/scholarships/category/masters'},
    { name: 'PhD', path: '/scholarships/category/phd'},
  ],
  Tenders: [
    { name: 'All Tenders', path: '/tenders'},
    { name: 'Government Tenders', path: '/tenders/category/government'},
    { name: 'Private Sector Tenders', path: '/tenders/category/private-sector'},
    { name: 'NGO Tenders', path: '/tenders/category/ngo'},
  ],
  Opportunities: [
    { name: 'All Opportunities', path: '/opportunities'},
    { name: 'Internships', path: '/opportunities/category/internships'},
    { name: 'Fellowships', path: '/opportunities/category/fellowships'},
    { name: 'Grants', path: '/opportunities/category/grants'},
    { name: 'Training', path: '/opportunities/category/training'},
    { name: 'Conferences', path: '/opportunities/category/conferences'},
    { name: 'Workshops', path: '/opportunities/category/workshops'},
  ],
};

function mergeDynamicSubLinks(
  base: SubLink[],
  dbCats: CategoryItem[],
  moduleName: CategoryItem['module'],
  routeBase: string
): SubLink[] {
  const existingPaths = new Set(base.map((b) => b.path.toLowerCase()));
  const extras: SubLink[] = dbCats
    .filter((c) => c.module === moduleName)
    .map((c) => ({
      name: c.name,
      path: `${routeBase}/category/${c.slug}`,
    }))
    .filter((item) => !existingPaths.has(item.path.toLowerCase()));
  return [...base, ...extras];
}

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setMenuOpen] = React.useState(false);
  const [isSearchOpen, setSearchOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState('');
  const [dbCategories, setDbCategories] = React.useState<CategoryItem[]>([]);
  const [expandedMobileKey, setExpandedMobileKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchPublicPortalData();
        setDbCategories(data.categories);
      } catch {
        // fallback cleanly to default sublinks
      }
    };
    loadCategories();
    const onUpdated = () => loadCategories();
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdated);
  }, []);

  React.useEffect(() => {
    const handleOpenMenu = () => setMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);

  const navLinks: NavItem[] = React.useMemo(
    () => [
      { key: 'home', name: t('nav.home'), path: '/'},
      {
        key: 'news',
        name: t('nav.news'),
        path: '/news',
        matchPrefix: '/news',
        subLinks: mergeDynamicSubLinks(DEFAULT_SUBLINKS.News, dbCategories, 'News', '/news'),
      },
      {
        key: 'jobs',
        name: t('nav.jobs'),
        path: '/jobs',
        matchPrefix: '/jobs',
        subLinks: mergeDynamicSubLinks(DEFAULT_SUBLINKS.Jobs, dbCategories, 'Jobs', '/jobs'),
      },
      {
        key: 'scholarships',
        name: t('nav.scholarships'),
        path: '/scholarships',
        matchPrefix: '/scholarships',
        subLinks: mergeDynamicSubLinks(DEFAULT_SUBLINKS.Scholarships, dbCategories, 'Scholarships', '/scholarships'),
      },
      {
        key: 'tenders',
        name: t('nav.tenders'),
        path: '/tenders',
        matchPrefix: '/tenders',
        subLinks: mergeDynamicSubLinks(DEFAULT_SUBLINKS.Tenders, dbCategories, 'Tenders', '/tenders'),
      },
      {
        key: 'opportunities',
        name: t('nav.opportunities'),
        path: '/opportunities',
        matchPrefix: '/opportunities',
        subLinks: mergeDynamicSubLinks(DEFAULT_SUBLINKS.Opportunities, dbCategories, 'Others', '/opportunities'),
      },
      { key: 'about', name: t('nav.about'), path: '/about', matchPrefix: '/about'},
    ],
    [dbCategories, t]
  );

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const brandParts = (settings.websiteName || 'Rwanda Opportunities').trim().split(/\s+/);
  const brandFirst = brandParts[0] || 'Rwanda';
  const brandRest = brandParts.slice(1).join(' ') || 'Opportunities';

  const socialItems = [
    { href: settings.socialLinks?.facebook, Icon: Facebook, label: 'Facebook'},
    { href: settings.socialLinks?.twitter, Icon: Twitter, label: 'X'},
    { href: settings.socialLinks?.linkedin, Icon: Linkedin, label: 'LinkedIn'},
    { href: settings.socialLinks?.youtube, Icon: Youtube, label: 'YouTube'},
  ].filter((s) => Boolean(s.href && s.href.trim() && s.href.trim() !== '#'));

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 md:h-[74px] flex justify-between items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2 md:gap-3 group active:scale-95 transition-transform min-w-0">
            <div className="w-8 h-8 md:w-11 md:h-11 bg-[#083D91] rounded-full flex items-center justify-center p-1 md:p-1.5 overflow-hidden flex-shrink-0 shadow-sm">
              <img src={settings.logoUrl} alt={settings.websiteName} className="w-full h-full object-contain"/>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm md:text-lg font-bold text-[#083D91] leading-none tracking-tight truncate">
                {brandFirst}
              </span>
              <span className="text-xs sm:text-sm md:text-lg font-bold text-[#14B8A6] leading-tight tracking-tight truncate">
                {brandRest}
              </span>
            </div>
          </NavLink>

          {/* Desktop Navigation (1024px+ prevents crowding on 768px tablets) */}
          <nav className="hidden lg:flex items-center gap-5 xl:gap-7" aria-label="Main navigation">
            {navLinks.map((link) => {
              const isCurrent =
                link.path === '/'? location.pathname === '/': Boolean(link.matchPrefix && location.pathname.startsWith(link.matchPrefix));

              return (
                <div key={link.key} className="relative group">
                  <NavLink
                    to={link.path}
                    end={link.path === '/'}
                    className={cn(
                      'text-[13px] lg:text-sm font-semibold flex items-center gap-1 py-2 border-b-2 transition-all whitespace-nowrap',
                      isCurrent
                        ? 'text-[#14B8A6] border-[#14B8A6]': 'text-[#102B4E] border-transparent hover:text-[#14B8A6] hover:border-[#14B8A6]')}
                  >
                    {link.name}
                    {link.subLinks && (
                      <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform"/>
                    )}
                  </NavLink>

                  {link.subLinks && (
                    <div
                      className={cn(
                        'absolute top-full pt-2 w-60 max-w-[calc(100vw-2rem)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50',
                        link.key === 'opportunities' || link.key === 'tenders' ? 'right-0' : 'left-0'
                      )}
                    >
                      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 overflow-hidden">
                        {link.subLinks.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            className="block px-4 py-2.5 text-xs font-bold text-[#102B4E] hover:bg-teal-50 hover:text-teal-700 transition-colors">
                            {sub.name}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button" onClick={() => setSearchOpen((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#102B4E] hover:text-[#14B8A6] hover:bg-slate-50 rounded-full transition-colors cursor-pointer" aria-label={t('nav.search')}
              aria-expanded={isSearchOpen}
            >
              <Search size={19} />
            </button>
          </nav>

          {/* Mobile & Tablet Actions (< 1024px) */}
          <div className="flex items-center gap-0.5 lg:hidden">
            <button
              type="button" onClick={() => setSearchOpen((prev) => !prev)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#102B4E] active:bg-slate-100 rounded-full transition-colors" aria-label={t('nav.search')}
            >
              <Search size={20} />
            </button>
            <button
              type="button" onClick={() => setMenuOpen(true)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#102B4E] active:bg-slate-100 rounded-full transition-colors" aria-label="Open menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable Quick Search Bar */}
        {isSearchOpen && (
          <div className="border-t border-slate-100 bg-slate-50/95 px-3 sm:px-4 py-3">
            <form onSubmit={handleHeaderSearch} className="max-w-3xl mx-auto flex items-center gap-1.5 sm:gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input
                  type="text" autoFocus
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="w-full min-h-[44px] pl-9 sm:pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-[#102B4E] focus:outline-none focus:border-[#14B8A6]"/>
              </div>
              <button
                type="submit" className="min-h-[44px] bg-[#083D91] hover:bg-[#07366D] text-white px-3.5 sm:px-5 py-2.5 rounded-xl text-xs font-bold transition-colors flex-shrink-0">
                {t('search.button')}
              </button>
              <button
                type="button" onClick={() => setSearchOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 flex-shrink-0" aria-label="Close search">
                <X size={18} />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Mobile & Tablet Sidebar Drawer */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[300px] max-w-[85vw] bg-white shadow-2xl flex flex-col p-5 overflow-y-auto pb-safe">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <span className="font-bold text-[#083D91] uppercase tracking-widest text-xs">{t('nav.menu')}</span>
              <button
                type="button" onClick={() => setMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600" aria-label="Close menu">
                <X size={22} />
              </button>
            </div>

            {/* Mobile Language Switcher */}
            <div className="mb-4 p-3 bg-[#F1F5F9] rounded-xl flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[#102B4E] flex items-center gap-1.5">
                <Globe size={14} className="text-[#14B8A6]"/> Language
              </span>
              <div className="flex items-center gap-1">
                {(['Kinyarwanda', 'English'] as const).map((langOpt) => (
                  <button
                    key={langOpt}
                    type="button" onClick={() => setLanguage(langOpt)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors',
                      language === langOpt
                        ? 'bg-[#083D91] text-white': 'bg-white text-slate-600 hover:text-[#083D91]')}
                  >
                    {langOpt === 'Kinyarwanda'? 'RW': 'EN'}
                  </button>
                ))}
              </div>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Mobile menu">
              {navLinks.map((link) => {
                const isExpanded = expandedMobileKey === link.key;
                return (
                  <div key={link.key} className="border-b border-slate-100 py-1">
                    <div className="flex items-center justify-between">
                      <NavLink
                        to={link.path}
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'text-sm font-bold py-2.5 flex-1',
                            isActive ? 'text-[#14B8A6]': 'text-[#102B4E]')
                        }
                      >
                        {link.name}
                      </NavLink>
                      {link.subLinks && (
                        <button
                          type="button" onClick={() => setExpandedMobileKey(isExpanded ? null : link.key)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400" aria-label={`Toggle ${link.name} subcategories`}
                        >
                          <ChevronDown size={16} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                        </button>
                      )}
                    </div>
                    {link.subLinks && isExpanded && (
                      <div className="pl-3 pb-2 space-y-1">
                        {link.subLinks.map((sub) => (
                          <NavLink
                            key={sub.path}
                            to={sub.path}
                            onClick={() => setMenuOpen(false)}
                            className="block text-xs font-medium text-slate-500 hover:text-[#14B8A6] py-1.5">
                            {sub.name}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <NavLink
                to="/contact" onClick={() => setMenuOpen(false)}
                className="text-sm font-bold text-[#102B4E] py-3 border-b border-slate-100">
                {t('nav.contact')}
              </NavLink>
              <NavLink
                to="/search" onClick={() => setMenuOpen(false)}
                className="text-sm font-bold text-[#14B8A6] py-3 border-b border-slate-100 flex items-center gap-2">
                <Search size={15} /> {t('nav.search')}
              </NavLink>
              <div className="flex gap-4 pt-3 text-xs text-slate-500">
                <NavLink to="/privacy" onClick={() => setMenuOpen(false)} className="hover:text-[#083D91]">
                  {t('footer.privacy')}
                </NavLink>
                <NavLink to="/terms" onClick={() => setMenuOpen(false)} className="hover:text-[#083D91]">
                  {t('footer.terms')}
                </NavLink>
              </div>
            </nav>

            {socialItems.length > 0 && (
              <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4">
                {socialItems.map(({ href, Icon, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank" rel="noopener noreferrer" aria-label={label}
                    className="p-2 rounded-full bg-slate-100 text-slate-600 hover:text-[#083D91]">
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
