import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mail, Send, Home, Newspaper, Briefcase, GraduationCap, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { Facebook, Twitter, Linkedin, Youtube } from '../ui/SocialIcons';
import { cn } from '@/src/lib/utils';
import { useSettings } from '@/src/lib/SettingsContext';

export function Footer() {
  const { settings } = useSettings();
  return (
    <footer className="bg-[#07366D] text-white pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-montserrat">
                  {settings.websiteName.split(' ')[0]}
                </span>
                <span className="text-xl font-bold font-montserrat text-teal-400">
                  {settings.websiteName.split(' ').slice(1).join(' ')}
                </span>
              </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed max-w-sm">
              {settings.seo.defaultDescription}
            </p>
            <div className="flex gap-4">
              <a href={settings.socialLinks.facebook} target="_blank" rel="noreferrer"><Facebook size={18} className="hover:text-teal-400 transition-colors cursor-pointer" /></a>
              <a href={settings.socialLinks.twitter} target="_blank" rel="noreferrer"><Twitter size={18} className="hover:text-teal-400 transition-colors cursor-pointer" /></a>
              <a href={settings.socialLinks.linkedin} target="_blank" rel="noreferrer"><Linkedin size={18} className="hover:text-teal-400 transition-colors cursor-pointer" /></a>
              <a href={settings.socialLinks.youtube} target="_blank" rel="noreferrer"><Youtube size={18} className="hover:text-teal-400 transition-colors cursor-pointer" /></a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold text-lg mb-6 text-teal-400">Quick Links</h4>
              <ul className="space-y-4 text-sm text-slate-300">
                <li><NavLink to="/" className="hover:text-white transition-colors">Home</NavLink></li>
                <li><NavLink to="/news" className="hover:text-white transition-colors">News (Kinyarwanda)</NavLink></li>
                <li><NavLink to="/jobs" className="hover:text-white transition-colors">Jobs</NavLink></li>
                <li><NavLink to="/scholarships" className="hover:text-white transition-colors">Scholarships</NavLink></li>
              </ul>
            </div>
            <div className="pt-12">
              <ul className="space-y-4 text-sm text-slate-300">
                <li><NavLink to="/tenders" className="hover:text-white transition-colors">Tenders</NavLink></li>
                <li><NavLink to="/opportunities" className="hover:text-white transition-colors">Opportunities</NavLink></li>
                <li><NavLink to="/about" className="hover:text-white transition-colors">About Us</NavLink></li>
                <li><NavLink to="/admin" className="text-teal-400/60 hover:text-teal-400 transition-colors font-medium">Admin Portal</NavLink></li>
              </ul>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-bold text-lg mb-6 text-teal-400">Subscribe to our Newsletter</h4>
            <p className="text-sm text-slate-300 mb-6">Stay informed. Stay ahead. Get the latest opportunities delivered to your inbox.</p>
            <form 
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
                if (!email) return;
                try {
                  const { collection, addDoc } = await import('firebase/firestore');
                  const { db } = await import('../../lib/firebase');
                  await addDoc(collection(db, 'subscribers'), {
                    email,
                    subscribedAt: new Date().toISOString(),
                    status: 'active'
                  });
                  alert('Thank you for subscribing!');
                  (e.target as HTMLFormElement).reset();
                } catch (err) {
                  console.error(err);
                  alert('Failed to subscribe. Please try again.');
                }
              }}
            >
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Your email address"
                  className="w-full bg-white/10 border border-white/20 rounded-md py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-teal-400 transition-all"
                />
              </div>
              <button type="submit" className="bg-teal-500 hover:bg-teal-600 px-6 rounded-md font-bold transition-all flex items-center gap-2">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>© 2025 Rwanda Opportunities. All rights reserved.</p>
          <div className="flex gap-6">
            <NavLink to="/privacy" className="hover:text-white transition-colors">Privacy Policy</NavLink>
            <NavLink to="/terms" className="hover:text-white transition-colors">Terms of Use</NavLink>
            <NavLink to="/contact" className="hover:text-white transition-colors">Contact</NavLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-1 py-1 pb-safe flex justify-around items-center z-50 md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
      {[
        { to: "/", icon: Home, label: "Home" },
        { to: "/news", icon: Newspaper, label: "News" },
        { to: "/jobs", icon: Briefcase, label: "Jobs" },
        { to: "/scholarships", icon: GraduationCap, label: "Scholarships" },
      ].map((link) => (
        <NavLink 
          key={link.to}
          to={link.to} 
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 transition-all px-2 py-2 rounded-2xl relative flex-1 min-w-0", 
            isActive ? "text-[#083D91]" : "text-slate-400"
          )}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div 
                  layoutId="mobile-nav-active"
                  className="absolute inset-0 bg-blue-50/80 rounded-2xl z-[-1]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <link.icon size={20} className={cn("transition-transform duration-200", isActive && "scale-110")} />
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-tight truncate w-full text-center",
                isActive ? "opacity-100" : "opacity-70"
              )}>
                {link.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
      <button 
        onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
        className="flex flex-col items-center gap-1 text-slate-400 px-2 py-2 rounded-2xl flex-1 active:scale-90 transition-transform"
      >
        <MoreHorizontal size={20} />
        <span className="text-[9px] font-bold uppercase tracking-tight opacity-70">More</span>
      </button>
    </nav>
  );
}
