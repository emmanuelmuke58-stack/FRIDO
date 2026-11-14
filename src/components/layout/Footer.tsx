import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Mail,
  Phone,
  MapPin,
  Home,
  Newspaper,
  Briefcase,
  GraduationCap,
  MoreHorizontal,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Facebook, Twitter, Linkedin, Youtube } from '../ui/SocialIcons';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import { cn } from '@/src/lib/utils';
import { useSettings } from '@/src/lib/SettingsContext';
import { useLanguage } from '@/src/lib/LanguageContext';
import { subscribeToNewsletter, unsubscribeFromNewsletter } from '@/src/lib/publicData';

export function Footer() {
  const { settings } = useSettings();
  const { t } = useLanguage();
  const [emailInput, setEmailInput] = React.useState('');
  const [consentChecked, setConsentChecked] = React.useState(true);
  const [mode, setMode] = React.useState<'subscribe'| 'unsubscribe'>('subscribe');
  const [subStatus, setSubStatus] = React.useState<{ type: 'success'| 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const brandParts = (settings.websiteName || 'Rwanda Opportunities').trim().split(/\s+/);
  const brandFirst = brandParts[0] || 'Rwanda';
  const brandRest = brandParts.slice(1).join(' ') || 'Opportunities';

  const socialItems = [
    { href: settings.socialLinks?.facebook, Icon: Facebook, label: 'Facebook'},
    { href: settings.socialLinks?.twitter, Icon: Twitter, label: 'X'},
    { href: settings.socialLinks?.linkedin, Icon: Linkedin, label: 'LinkedIn'},
    { href: settings.socialLinks?.youtube, Icon: Youtube, label: 'YouTube'},
  ].filter((s) => Boolean(s.href && s.href.trim() && s.href.trim() !== '#'));

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = emailInput.trim();
    if (!cleaned) return;
    if (mode === 'subscribe'&& !consentChecked) {
      setSubStatus({ type: 'error', text: 'Please accept the newsletter consent notice to subscribe.'});
      return;
    }

    setSubmitting(true);
    setSubStatus(null);
    try {
      if (mode === 'subscribe') {
        const res = await subscribeToNewsletter(cleaned);
        setSubStatus({
          type: res.status === 'already_subscribed'? 'error': 'success',
          text: res.message,
        });
        if (res.status !== 'already_subscribed') {
          setEmailInput('');
        }
      } else {
        const res = await unsubscribeFromNewsletter(cleaned);
        setSubStatus({ type: 'success', text: res.message });
        setEmailInput('');
      }
    } catch (err: any) {
      setSubStatus({
        type: 'error',
        text: err?.message || 'Unable to process your request right now. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-auto">
      {/* Newsletter Subscription Strip (matches editorial reference) */}
      <section className="bg-gradient-to-r from-[#062C6B] via-[#083D91] to-[#0A49AD] text-white py-10 md:py-12 px-4 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-10">
            <div className="flex items-start sm:items-center gap-4 max-w-xl">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-[#14B8A6]">
                <Mail size={26} />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-bold leading-tight">
                  {t('newsletter.title')}
                </h3>
                <p className="text-xs md:text-sm text-white/80 mt-1 leading-relaxed">
                  {t('newsletter.subtitle')}
                </p>
              </div>
            </div>

            <div className="w-full lg:max-w-lg">
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    name="email" type="email" required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={t('newsletter.placeholder')}
                    className="w-full min-h-[44px] bg-white text-[#102B4E] placeholder:text-slate-400 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]"/>
                </div>
                <button
                  type="submit" disabled={submitting}
                  className="min-h-[44px] bg-[#14B8A6] hover:bg-[#0D9488] text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer whitespace-nowrap shadow-lg shadow-teal-950/20">
                  {submitting
                    ? '...': mode === 'subscribe'? t('newsletter.subscribe')
                      : t('newsletter.unsubscribe')}
                </button>
              </form>

              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/75">
                {mode === 'subscribe'? (
                  <label className="flex items-center gap-2 cursor-pointer min-h-[36px]">
                    <input
                      type="checkbox" checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="rounded border-white/30 text-[#14B8A6] focus:ring-[#14B8A6]"/>
                    <span>{t('newsletter.consent')}</span>
                  </label>
                ) : (
                  <span>Enter your subscribed email above to opt out of future updates.</span>
                )}
                <button
                  type="button" onClick={() => {
                    setMode(mode === 'subscribe'? 'unsubscribe': 'subscribe');
                    setSubStatus(null);
                  }}
                  className="text-teal-300 hover:text-white underline font-semibold cursor-pointer min-h-[36px] inline-flex items-center">
                  {mode === 'subscribe'? t('newsletter.unsubscribe') : 'Back to Subscribe'}
                </button>
              </div>

              {subStatus && (
                <div
                  role="status" className={cn(
                    'mt-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2',
                    subStatus.type === 'success'? 'bg-teal-500/20 text-teal-200 border border-teal-400/30': 'bg-red-500/20 text-red-200 border border-red-400/30')}
                >
                  {subStatus.type === 'success'? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{subStatus.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Navy Footer */}
      <footer className="bg-[#07366D] text-white pt-12 sm:pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 mb-10 sm:mb-12">
            {/* Brand */}
            <div className="space-y-4">
              <NavLink to="/" className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden flex-shrink-0">
                  <img src={settings.logoUrl} alt={settings.websiteName} className="w-full h-full object-contain"/>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold leading-tight">{brandFirst}</span>
                  <span className="text-lg font-bold text-[#14B8A6] leading-tight">
                    {brandRest}
                  </span>
                </div>
              </NavLink>
              <p className="text-slate-300 text-sm leading-relaxed">
                More Opportunities. A Stronger Rwanda. {settings.seo.defaultDescription}
              </p>
              {socialItems.length > 0 && (
                <div className="flex gap-3 pt-1">
                  {socialItems.map(({ href, Icon, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank" rel="noopener noreferrer" aria-label={label}
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-[#14B8A6] flex items-center justify-center transition-colors">
                      <Icon size={16} />
                    </a>
                  ))}
                </div>
              )}
              <div className="pt-1">
                <PWAInstallButton variant="footer" />
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-bold text-base mb-5 text-[#14B8A6]">{t('footer.quickLinks')}</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><NavLink to="/" className="hover:text-white transition-colors">{t('nav.home')}</NavLink></li>
                <li><NavLink to="/news" className="hover:text-white transition-colors">{t('nav.news')}</NavLink></li>
                <li><NavLink to="/jobs" className="hover:text-white transition-colors">{t('nav.jobs')}</NavLink></li>
                <li><NavLink to="/scholarships" className="hover:text-white transition-colors">{t('nav.scholarships')}</NavLink></li>
                <li><NavLink to="/tenders" className="hover:text-white transition-colors">{t('nav.tenders')}</NavLink></li>
                <li><NavLink to="/opportunities" className="hover:text-white transition-colors">{t('nav.opportunities')}</NavLink></li>
              </ul>
            </div>

            {/* About Us */}
            <div>
              <h4 className="font-bold text-base mb-5 text-[#14B8A6]">{t('footer.aboutUs')}</h4>
              <ul className="space-y-3 text-sm text-slate-300">
                <li><NavLink to="/about" className="hover:text-white transition-colors">About {settings.websiteName}</NavLink></li>
                <li><NavLink to="/contact" className="hover:text-white transition-colors">{t('nav.contact')}</NavLink></li>
                <li><NavLink to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</NavLink></li>
                <li><NavLink to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</NavLink></li>
                <li><NavLink to="/search" className="hover:text-white transition-colors">{t('nav.search')}</NavLink></li>
                <li>
                  <NavLink to="/admin" className="text-teal-300/80 hover:text-teal-300 transition-colors font-medium">
                    Admin Portal
                  </NavLink>
                </li>
              </ul>
            </div>

            {/* Contact & Info */}
            <div>
              <h4 className="font-bold text-base mb-5 text-[#14B8A6]">{t('footer.contactNewsletter')}</h4>
              <ul className="space-y-3.5 text-sm text-slate-300">
                {settings.contactEmail && (
                  <li>
                    <a href={`mailto:${settings.contactEmail}`} className="flex items-center gap-2.5 hover:text-white transition-colors break-all">
                      <Mail size={15} className="text-[#14B8A6] flex-shrink-0"/>
                      <span>{settings.contactEmail}</span>
                    </a>
                  </li>
                )}
                {settings.contactPhone && (
                  <li>
                    <a href={`tel:${settings.contactPhone.replace(/\s+/g, '')}`} className="flex items-center gap-2.5 hover:text-white transition-colors">
                      <Phone size={15} className="text-[#14B8A6] flex-shrink-0"/>
                      <span>{settings.contactPhone}</span>
                    </a>
                  </li>
                )}
                {settings.address && (
                  <li className="flex items-center gap-2.5">
                    <MapPin size={15} className="text-[#14B8A6] flex-shrink-0"/>
                    <span>{settings.address}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
            <p>© {new Date().getFullYear()} {settings.websiteName}. {t('footer.rights')}</p>
            <div className="flex flex-wrap justify-center gap-5">
              <NavLink to="/privacy" className="hover:text-white transition-colors">{t('footer.privacy')}</NavLink>
              <NavLink to="/terms" className="hover:text-white transition-colors">{t('footer.terms')}</NavLink>
              <NavLink to="/contact" className="hover:text-white transition-colors">{t('nav.contact')}</NavLink>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MobileBottomNav() {
  const { t } = useLanguage();
  const [hiddenByDetailCta, setHiddenByDetailCta] = React.useState(false);

  React.useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ hidden?: boolean }>).detail;
      setHiddenByDetailCta(Boolean(detail?.hidden));
    };
    window.addEventListener('toggle-mobile-bottom-nav', onToggle);
    return () => window.removeEventListener('toggle-mobile-bottom-nav', onToggle);
  }, []);

  if (hiddenByDetailCta) return null;

  return (
    <nav
      aria-label="Mobile bottom navigation" className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 pt-1 pb-safe flex justify-around items-center z-50 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {[
        { to: '/', icon: Home, label: t('nav.home'), end: true },
        { to: '/news', icon: Newspaper, label: t('nav.news'), end: false },
        { to: '/jobs', icon: Briefcase, label: t('nav.jobs'), end: false },
        { to: '/scholarships', icon: GraduationCap, label: t('nav.scholarships'), end: false },
      ].map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 transition-all px-1.5 py-1.5 min-h-[44px] rounded-xl relative flex-1 min-w-0',
              isActive ? 'text-[#083D91]': 'text-slate-500')
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-active" className="absolute inset-x-1 inset-y-0.5 bg-blue-50/90 rounded-xl z-[-1]" transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <link.icon size={19} className={cn('transition-transform duration-200', isActive && 'text-[#083D91] scale-105')} />
              <span
                className={cn(
                  'text-[10px] font-bold tracking-tight truncate w-full text-center',
                  isActive ? 'text-[#083D91]': 'text-slate-500')}
              >
                {link.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
      <button
        type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-mobile-menu'))}
        className="flex flex-col items-center justify-center gap-0.5 text-slate-500 px-1.5 py-1.5 min-h-[44px] rounded-xl flex-1 active:scale-95 transition-transform" aria-label={t('nav.more')}
      >
        <MoreHorizontal size={19} />
        <span className="text-[10px] font-bold tracking-tight">{t('nav.more')}</span>
      </button>
    </nav>
  );
}
