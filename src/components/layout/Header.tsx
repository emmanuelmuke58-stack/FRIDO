import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, MapPin } from 'lucide-react';
import { Facebook, Twitter, Linkedin, Youtube } from '../ui/SocialIcons';
import { cn } from '@/src/lib/utils';
import { useSettings } from '@/src/lib/SettingsContext';

export function TopBar() {
  const { settings } = useSettings();
  const [date] = React.useState(new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }));

  return (
    <div className="bg-[#083D91] text-white py-2 px-4 hidden md:block">
      <div className="max-w-7xl mx-auto flex justify-between items-center text-xs">
        <div className="flex items-center gap-4">
          <span className="font-medium">{date}</span>
          <span className="flex items-center gap-1 opacity-80">
            <MapPin size={12} /> {settings.address}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <NavLink to="/news?lang=Kinyarwanda" className="hover:text-teal-400 transition-colors">Kinyarwanda</NavLink>
            <span className="opacity-30">|</span>
            <NavLink to="/news?lang=English" className="text-teal-400 font-bold hover:underline">English</NavLink>
          </div>
          <div className="flex items-center gap-4">
            <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer"><Facebook size={14} className="cursor-pointer hover:text-teal-400 transition-colors" /></a>
            <a href={settings.socialLinks.twitter} target="_blank" rel="noreferrer"><Twitter size={14} className="cursor-pointer hover:text-teal-400 transition-colors" /></a>
            <a href={settings.socialLinks.linkedin} target="_blank" rel="noreferrer"><Linkedin size={14} className="cursor-pointer hover:text-teal-400 transition-colors" /></a>
            <a href={settings.socialLinks.youtube} target="_blank" rel="noreferrer"><Youtube size={14} className="cursor-pointer hover:text-teal-400 transition-colors" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_LINKS = [
  { name: 'Home', path: '/' },
  {
    name: 'News',
    path: '/news',
    subLinks: [
      { name: 'All News', path: '/news' },
      { name: 'Rwanda (Kinyarwanda)', path: '/news?lang=Kinyarwanda' },
      { name: 'Rwanda (English)', path: '/news?lang=English' },
      { name: 'Business', path: '/news/category/business' },
      { name: 'Economy', path: '/news/category/economy' },
      { name: 'Technology', path: '/news/category/technology' },
      { name: 'International', path: '/news/category/international' },
    ]
  },
  {
    name: 'Jobs',
    path: '/jobs',
    subLinks: [
      { name: 'All Jobs', path: '/jobs' },
      { name: 'Government Jobs', path: '/jobs/category/government' },
      { name: 'Private Sector Jobs', path: '/jobs/category/private-sector' },
      { name: 'NGO Jobs', path: '/jobs/category/ngo' },
      { name: 'International Jobs', path: '/jobs/category/international' },
    ]
  },
  {
    name: 'Scholarships',
    path: '/scholarships',
    subLinks: [
      { name: 'All Scholarships', path: '/scholarships' },
      { name: 'Local Scholarships', path: '/scholarships/category/local' },
      { name: 'International Scholarships', path: '/scholarships/category/international' },
      { name: 'Undergraduate', path: '/scholarships/category/undergraduate' },
      { name: "Master's", path: '/scholarships/category/masters' },
      { name: 'PhD', path: '/scholarships/category/phd' },
    ]
  },
  {
    name: 'Tenders',
    path: '/tenders',
    subLinks: [
      { name: 'All Tenders', path: '/tenders' },
      { name: 'Government Tenders', path: '/tenders/category/government' },
      { name: 'Private Sector Tenders', path: '/tenders/category/private-sector' },
      { name: 'NGO Tenders', path: '/tenders/category/ngo' },
    ]
  },
  {
    name: 'Opportunities',
    path: '/opportunities',
    subLinks: [
      { name: 'All Opportunities', path: '/opportunities' },
      { name: 'Internships', path: '/opportunities/category/internships' },
      { name: 'Fellowships', path: '/opportunities/category/fellowships' },
      { name: 'Grants', path: '/opportunities/category/grants' },
      { name: 'Training', path: '/opportunities/category/training' },
      { name: 'Conferences', path: '/opportunities/category/conferences' },
      { name: 'Workshops', path: '/opportunities/category/workshops' },
    ]
  },
  { name: 'About', path: '/about' },
];

export function Navbar() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [isMenuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenMenu = () => setMenuOpen(true);
    window.addEventListener('open-mobile-menu', handleOpenMenu);
    return () => window.removeEventListener('open-mobile-menu', handleOpenMenu);
  }, []);

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 md:h-20 flex justify-between items-center">
          <NavLink to="/" className="flex items-center gap-2 md:gap-3 group active:scale-95 transition-transform">
            <div className="w-9 h-9 md:w-12 md:h-12 bg-[#083D91] rounded-full flex items-center justify-center p-1 md:p-1.5 overflow-hidden flex-shrink-0 shadow-sm">
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm md:text-xl font-bold font-montserrat text-[#083D91] leading-tight tracking-tight">
                {settings.websiteName.split(' ')[0]}
              </span>
              <span className="text-sm md:text-xl font-bold font-montserrat text-teal-600 leading-tight tracking-tight">
                {settings.websiteName.split(' ').slice(1).join(' ')}
              </span>
            </div>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <div key={link.name} className="relative group">
                <NavLink
                  to={link.path}
                  className={({ isActive }) =>
                    cn(
                      "text-sm font-semibold flex items-center gap-1 py-2 border-b-2 transition-all",
                      isActive
                        ? "text-teal-600 border-teal-600"
                        : "text-[#102B4E] border-transparent hover:text-teal-600 hover:border-teal-600"
                    )
                  }
                >
                  {link.name}
                  {link.subLinks && <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform" />}
                </NavLink>

                {link.subLinks && (
                  <div className="absolute left-0 top-full pt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 overflow-hidden">
                      {link.subLinks.map(sub => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          className="block px-4 py-2.5 text-xs font-bold text-[#102B4E] hover:bg-teal-50 hover:text-teal-600 transition-colors"
                        >
                          {sub.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <NavLink to="/search" className="p-2 text-[#102B4E] hover:text-teal-600 transition-colors" aria-label="Search">
              <Search size={20} />
            </NavLink>
          </nav>

          {/* Mobile Actions */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => navigate('/search')}
              className="p-2 text-[#102B4E] active:bg-slate-50 rounded-full transition-colors"
              aria-label="Search"
            >
              <Search size={20} />
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 text-[#102B4E] active:bg-slate-50 rounded-full transition-colors"
              aria-label="Open menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-[280px] bg-white shadow-2xl flex flex-col p-6 animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-[#102B4E] uppercase tracking-widest text-xs">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 text-slate-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {NAV_LINKS.map(link => (
                <div key={link.name} className="border-b border-slate-50 py-1.5">
                  <NavLink
                    to={link.path}
                    onClick={() => setMenuOpen(false)}
                    className="text-base font-bold text-[#102B4E] py-1.5 flex justify-between items-center"
                  >
                    {link.name}
                  </NavLink>
                  {link.subLinks && (
                    <div className="pl-3 pb-2 space-y-1">
                      {link.subLinks.slice(1).map(sub => (
                        <NavLink
                          key={sub.path}
                          to={sub.path}
                          onClick={() => setMenuOpen(false)}
                          className="block text-xs font-medium text-slate-500 hover:text-teal-600 py-1"
                        >
                          {sub.name}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <NavLink to="/contact" onClick={() => setMenuOpen(false)} className="text-base font-bold text-[#102B4E] py-2 border-b border-slate-50">
                Contact Us
              </NavLink>
            </nav>
            <div className="mt-auto pt-8 border-t border-slate-100 flex gap-4">
              <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer"><Facebook size={20} className="text-slate-400" /></a>
              <a href={settings.socialLinks.twitter} target="_blank" rel="noreferrer"><Twitter size={20} className="text-slate-400" /></a>
              <a href={settings.socialLinks.linkedin} target="_blank" rel="noreferrer"><Linkedin size={20} className="text-slate-400" /></a>
              <a href={settings.socialLinks.youtube} target="_blank" rel="noreferrer"><Youtube size={20} className="text-slate-400" /></a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
