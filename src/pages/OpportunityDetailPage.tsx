import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
  addDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArticleAdBanner, Opportunity } from '../types';
import {
  Home,
  ChevronRight,
  Building2,
  Calendar,
  MapPin,
  Eye,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  Star,
  Clock,
  FileText,
  Award,
  HeartHandshake,
  Send,
  Mail,
  Download,
  Maximize2,
  X as CloseIcon,
  ArrowRight,
  Image as ImageIcon,
  AlertCircle,
  Hash,
  ClipboardCheck,
  DollarSign,
} from 'lucide-react';
import { Facebook, X, Linkedin, WhatsApp, Pinterest } from '../components/ui/SocialIcons';
import DOMPurify from 'dompurify';
import { cn, safeDate, safeFormatDate } from '../lib/utils';
import {
  isOpportunityExpired,
  getOpportunityRoutePath,
  PUBLIC_DATA_UPDATED_EVENT,
} from '../lib/publicData';
import { useSettings } from '../lib/SettingsContext';

function hasRichContent(htmlOrText?: string): boolean {
  if (!htmlOrText) return false;
  const text = htmlOrText
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0;
}

function normalizeExternalUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function SidebarAdBanner({ ad }: { ad: ArticleAdBanner }) {
  const trimmedLink = (ad.linkUrl || '').trim();
  const isInternal = trimmedLink.startsWith('/');
  const label = ad.label?.trim();

  const imgEl = (
    <img
      src={ad.imageUrl}
      alt={ad.title || label || 'Advertisement'}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="w-full h-auto object-contain block"
    />
  );

  return (
    <div className="w-full">
      {label && (
        <div className="text-[11px] font-medium text-slate-400 text-center mb-1.5 select-none">
          {label}
        </div>
      )}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white p-1.5 transition-colors hover:border-slate-300">
        {trimmedLink ? (
          isInternal ? (
            <NavLink
              to={trimmedLink}
              aria-label={ad.title || 'Advertisement'}
              className="block w-full rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#083D91]"
            >
              {imgEl}
            </NavLink>
          ) : (
            <a
              href={normalizeExternalUrl(trimmedLink)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={ad.title || 'Advertisement'}
              className="block w-full rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#083D91]"
            >
              {imgEl}
            </a>
          )
        ) : (
          <div className="rounded-xl overflow-hidden">{imgEl}</div>
        )}
      </div>
    </div>
  );
}

function RelatedJobLogo({ logoUrl, organization }: { logoUrl?: string; organization: string }) {
  const [imgErr, setImgErr] = React.useState(false);

  if (logoUrl && !imgErr) {
    return (
      <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50/70 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
        <img
          src={logoUrl}
          alt={organization}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgErr(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="w-11 h-11 rounded-xl border border-slate-200 bg-[#F0F6FF] text-[#0B57D0] flex items-center justify-center shrink-0">
      <Building2 size={20} aria-hidden="true" />
    </div>
  );
}

export function OpportunityDetailPage() {
  const { slug } = useParams();
  const { settings } = useSettings();

  const [opp, setOpp] = React.useState<Opportunity | null>(null);
  const [relatedSideItems, setRelatedSideItems] = React.useState<Opportunity[]>([]);
  const [relatedCardItems, setRelatedCardItems] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [logoError, setLogoError] = React.useState(false);
  const [zoomedImg, setZoomedImg] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLogoError(false);
  }, [opp?.organizationLogo]);

  React.useEffect(() => {
    if (!zoomedImg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomedImg(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomedImg]);

  const fetchOpp = React.useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'opportunities'), where('status', '==', 'active'));
      const snap = await getDocs(q);
      const now = new Date();
      const allActiveRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity));
      const matched = allActiveRecords.find((o) => o.slug === slug) || null;
      const nonExpiredAll = allActiveRecords
        .filter((o) => !isOpportunityExpired(o, now))
        .sort((a, b) => (b.publishedAt || b.createdAt || '').localeCompare(a.publishedAt || a.createdAt || ''));

      if (matched) {
        setOpp(matched);
        const expiredNow = isOpportunityExpired(matched, now);

        if (!expiredNow) {
          updateDoc(doc(db, 'opportunities', matched.id), {
            views: increment(1),
          }).catch((err) => console.warn('View increment skipped:', err));
        }

        addDoc(collection(db, 'analytics'), {
          type: 'page_view',
          path: window.location.pathname,
          targetId: matched.id,
          category: matched.category,
          timestamp: new Date().toISOString(),
        }).catch(() => {});

        const others = nonExpiredAll.filter((o) => o.id !== matched.id);
        const byId = new Map(others.map((o) => [o.id, o]));

        // 1. Curated related items first
        const curated = (matched.relatedOpportunityIds || [])
          .map((rid) => byId.get(rid))
          .filter((item): item is Opportunity => Boolean(item));
        const usedIds = new Set(curated.map((c) => c.id));

        // 2. Same category scored by subCategory, location, and employer
        const sameCategory = others.filter((o) => !usedIds.has(o.id) && o.category === matched.category);
        const scored = sameCategory
          .map((item) => {
            let score = 0;
            if (item.subCategory && matched.subCategory && item.subCategory === matched.subCategory) score += 3;
            if (item.location && matched.location && item.location.toLowerCase() === matched.location.toLowerCase()) score += 2;
            if (item.organization.toLowerCase() === matched.organization.toLowerCase()) score += 1;
            return { item, score };
          })
          .sort((a, b) => b.score - a.score)
          .map((entry) => entry.item);

        const combined = [...curated, ...scored, ...others.filter((o) => o.category !== matched.category && !usedIds.has(o.id))];
        const uniqueOrdered: Opportunity[] = [];
        const seen = new Set<string>();
        for (const item of combined) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            uniqueOrdered.push(item);
          }
        }

        setRelatedSideItems(uniqueOrdered.slice(0, 5));
        setRelatedCardItems(uniqueOrdered.slice(0, 6));
      } else {
        setOpp(null);
        setRelatedSideItems(nonExpiredAll.slice(0, 5));
        setRelatedCardItems([]);
      }
    } catch (e) {
      console.error('Error loading opportunity:', e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => {
    fetchOpp();
    window.scrollTo(0, 0);
  }, [fetchOpp]);

  React.useEffect(() => {
    const onUpdate = () => fetchOpp();
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, onUpdate);
  }, [fetchOpp]);

  const isClosed = React.useMemo(() => {
    if (!opp) return false;
    return opp.status === 'expired' || isOpportunityExpired(opp, new Date());
  }, [opp]);

  const applyUrlClean = normalizeExternalUrl(opp?.applyUrl);
  const applyEmailClean = (opp?.applyEmail || '').trim();
  const mailtoHref = applyEmailClean && opp
    ? `mailto:${applyEmailClean}?subject=${encodeURIComponent(`Application: ${opp.title}`)}`
    : '';
  const hasStickyApplyBar = Boolean(!loading && opp && !isClosed && (applyUrlClean || mailtoHref));

  // Coordinate with MobileBottomNav so the sticky Apply Now button never collides on mobile
  React.useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('toggle-mobile-bottom-nav', { detail: { hidden: hasStickyApplyBar } })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('toggle-mobile-bottom-nav', { detail: { hidden: false } })
      );
    };
  }, [hasStickyApplyBar]);

  // Dynamic SEO metadata & JobPosting structured data
  React.useEffect(() => {
    if (!opp) return;

    const prevTitle = document.title;
    const targetTitle =
      opp.seoTitle?.trim() || `${opp.title} - ${opp.organization} | ${settings.websiteName}`;
    document.title = targetTitle;

    const plainDesc = (opp.summary || opp.description || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 220);

    const nextDesc = opp.seoDescription?.trim() || plainDesc || settings.seo.defaultDescription;

    const metaDesc = document.querySelector('meta[name="description"]');
    const prevDesc = metaDesc?.getAttribute('content') || '';
    if (metaDesc && nextDesc) metaDesc.setAttribute('content', nextDesc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const prevOgTitle = ogTitle?.getAttribute('content') || '';
    if (ogTitle) ogTitle.setAttribute('content', targetTitle);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    const prevOgDesc = ogDesc?.getAttribute('content') || '';
    if (ogDesc && nextDesc) ogDesc.setAttribute('content', nextDesc);

    const jsonLdId = 'opportunity-jobposting-jsonld';
    document.getElementById(jsonLdId)?.remove();

    if (opp.category === 'Jobs' && !isClosed) {
      const script = document.createElement('script');
      script.id = jsonLdId;
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: opp.title,
        description: plainDesc || opp.title,
        datePosted: opp.publishedAt || opp.createdAt,
        ...(opp.deadline ? { validThrough: opp.deadline } : {}),
        ...(opp.type ? { employmentType: opp.type } : {}),
        ...(opp.tenderRef ? { identifier: { '@type': 'PropertyValue', name: opp.organization, value: opp.tenderRef } } : {}),
        hiringOrganization: {
          '@type': 'Organization',
          name: opp.organization,
          ...(opp.organizationLogo ? { logo: opp.organizationLogo } : {}),
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: opp.location || 'Kigali',
            addressCountry: 'RW',
          },
        },
        ...(opp.salary
          ? {
              baseSalary: {
                '@type': 'MonetaryAmount',
                currency: 'RWF',
                value: {
                  '@type': 'QuantitativeValue',
                  value: opp.salary,
                },
              },
            }
          : {}),
        ...(opp.experienceRequired ? { experienceRequirements: opp.experienceRequired } : {}),
        ...(opp.educationRequired ? { educationRequirements: opp.educationRequired } : {}),
      });
      document.head.appendChild(script);
    }

    return () => {
      document.title = prevTitle;
      if (metaDesc && prevDesc) metaDesc.setAttribute('content', prevDesc);
      if (ogTitle && prevOgTitle) ogTitle.setAttribute('content', prevOgTitle);
      if (ogDesc && prevOgDesc) ogDesc.setAttribute('content', prevOgDesc);
      document.getElementById(jsonLdId)?.remove();
    };
  }, [opp, isClosed, settings.websiteName, settings.seo.defaultDescription]);

  const trackApplyClick = () => {
    if (!opp) return;
    updateDoc(doc(db, 'opportunities', opp.id), {
      clicks: increment(1),
    }).catch((err) => console.warn('Click increment skipped:', err));

    addDoc(collection(db, 'analytics'), {
      type: 'click',
      path: window.location.pathname,
      targetId: opp.id,
      category: opp.category,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  };

  const activeSidebarAds = React.useMemo(() => {
    return (settings.articleSidebarAds || [])
      .filter((ad) => ad.enabled !== false && Boolean((ad.imageUrl || '').trim()))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [settings.articleSidebarAds]);

  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-[1220px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-5 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-7 animate-pulse">
            <div className="space-y-4">
              <div className="h-10 w-full bg-slate-100 rounded-xl" />
              <div className="border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
                <div className="h-7 w-28 bg-blue-100 rounded-full" />
                <div className="h-8 w-3/4 bg-slate-200 rounded-lg" />
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 w-48 bg-slate-200 rounded" />
                    <div className="h-4 w-36 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="h-10 bg-slate-50 rounded-lg" />
                <div className="space-y-2.5 pt-2">
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-11/12" />
                  <div className="h-4 bg-slate-100 rounded w-4/5" />
                </div>
                <div className="h-12 bg-blue-100 rounded-xl w-full" />
              </div>
            </div>
            <div className="hidden lg:block space-y-6">
              <div className="h-80 bg-slate-100 rounded-2xl" />
              <div className="h-64 bg-slate-100 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="bg-white min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-lg w-full border border-slate-200 rounded-2xl p-8 sm:p-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E] mb-3">
            Job Listing Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mb-6">
            This opportunity may have been removed or moved to a different URL.
          </p>
          <NavLink
            to="/jobs"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#0B57D0] hover:bg-[#083D91] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            <span>Browse All Jobs</span>
            <ArrowRight size={16} />
          </NavLink>
        </div>
      </div>
    );
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const basePath = `/${opp.category === 'Others' ? 'opportunities' : opp.category.toLowerCase()}`;
  const categoryLabel = opp.category === 'Others' ? 'Opportunities' : opp.category;
  const pubDateFormatted = safeFormatDate(opp.publishedAt || opp.createdAt, 'MMM d, yyyy');
  const deadlineFormatted = safeDate(opp.deadline) ? safeFormatDate(opp.deadline, 'MMM d, yyyy') : '';

  const requirementsHtml = hasRichContent(opp.requirements) ? opp.requirements : '';
  const qualificationsHtml =
    hasRichContent(opp.qualifications) && opp.qualifications !== opp.requirements
      ? opp.qualifications
      : '';

  const instructionsHtml = hasRichContent(opp.applicationInstructions)
    ? opp.applicationInstructions
    : hasRichContent(opp.submissionInstructions)
      ? opp.submissionInstructions
      : '';

  const overviewHeading =
    opp.category === 'Jobs'
      ? 'Job Description'
      : opp.category === 'Scholarships'
        ? 'Program Description'
        : opp.category === 'Tenders'
          ? 'Tender Scope & Description'
          : 'Description';

  const structuredHighlights = [
    { icon: CheckCircle2, label: 'Experience Required', value: opp.experienceRequired },
    { icon: GraduationCap, label: 'Education Level', value: opp.educationRequired },
    {
      icon: DollarSign,
      label: opp.category === 'Scholarships' ? 'Award / Coverage' : 'Salary Information',
      value: opp.salary,
    },
    ...(opp.category === 'Scholarships' && opp.country
      ? [{ icon: MapPin, label: 'Study Country', value: opp.country }]
      : []),
    ...(opp.category === 'Scholarships' && opp.institution
      ? [{ icon: Building2, label: 'Host Institution', value: opp.institution }]
      : []),
  ].filter((item) => Boolean(item.value && String(item.value).trim()));

  const relatedSectionTitle =
    opp.category === 'Jobs' ? 'Related Jobs' : `Related ${categoryLabel}`;
  const viewMoreLabel =
    opp.category === 'Jobs' ? 'View More Jobs' : `View More ${categoryLabel}`;

  const primaryApplyHref = applyUrlClean || mailtoHref;
  const primaryApplyIsExternal = Boolean(applyUrlClean);
  const pinterestMedia = opp.coverImageUrl || opp.organizationLogo || '';

  return (
    <div className={cn('bg-white min-h-screen', hasStickyApplyBar ? 'pb-24 md:pb-16' : 'pb-16')}>
      <div className="max-w-[1220px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Breadcrumb Strip */}
        <nav
          aria-label="Breadcrumb"
          className="bg-[#F0F6FF] border border-[#DCE8FA] rounded-xl px-3.5 py-2.5 mb-4 sm:mb-5 flex items-center gap-1.5 text-xs sm:text-[13px] font-medium overflow-x-auto whitespace-nowrap scrollbar-hide"
        >
          <NavLink
            to="/"
            className="inline-flex items-center gap-1.5 text-[#0B57D0] hover:underline shrink-0"
          >
            <Home size={14} aria-hidden="true" />
            <span>Home</span>
          </NavLink>
          <ChevronRight size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
          <NavLink to={basePath} className="text-[#0B57D0] hover:underline shrink-0">
            {categoryLabel}
          </NavLink>
          <ChevronRight size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
          <span className="text-[#102B4E] font-medium truncate">{opp.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-7 lg:gap-8 items-start">
          {/* MAIN LEFT COLUMN */}
          <main className="min-w-0 w-full space-y-7">
            {/* Primary Job Content Container */}
            <article className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 md:p-8 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
              {/* Top Employment Type & Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {opp.type?.trim() && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0B57D0] text-white text-xs font-semibold leading-none">
                      <Briefcase size={13} aria-hidden="true" />
                      <span>{opp.type.trim()}</span>
                    </span>
                  )}
                  {isClosed && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold leading-none">
                      <AlertCircle size={13} aria-hidden="true" />
                      <span>Application Closed</span>
                    </span>
                  )}
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 tabular-nums">
                  <Eye size={14} className="text-slate-400" aria-hidden="true" />
                  <span>{(opp.views || 0).toLocaleString()} views</span>
                </span>
              </div>

              {/* Job Title (Largest text element in this section) */}
              <h1 className="mt-3 text-[23px] sm:text-[28px] lg:text-[33px] font-bold text-[#102B4E] leading-[1.2] tracking-tight break-words">
                {opp.title}
              </h1>

              {/* Company Logo + Employer Info */}
              <div className="mt-4 flex items-center gap-3.5 sm:gap-4 pb-4 border-b border-slate-200/80">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-slate-200 bg-slate-50/70 p-2 flex items-center justify-center shrink-0 overflow-hidden">
                  {opp.organizationLogo && !logoError ? (
                    <img
                      src={opp.organizationLogo}
                      alt={opp.organization}
                      referrerPolicy="no-referrer"
                      onError={() => setLogoError(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Building2 size={28} className="text-[#0B57D0]" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <NavLink
                    to={`${basePath}?org=${encodeURIComponent(opp.organization)}`}
                    className="block text-[16px] sm:text-[18px] font-bold text-[#102B4E] hover:text-[#0B57D0] transition-colors leading-snug truncate"
                  >
                    {opp.organization}
                  </NavLink>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] sm:text-sm text-slate-600">
                    {opp.location?.trim() && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{opp.location.trim()}</span>
                      </span>
                    )}
                    {opp.tenderRef?.trim() && (
                      <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                        <Hash size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                        <span>Ref: {opp.tenderRef.trim()}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Posted & Application Deadline Row */}
              {(pubDateFormatted || deadlineFormatted) && (
                <div className="py-3.5 border-b border-slate-200/80 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] sm:text-sm text-slate-700">
                  {pubDateFormatted && (
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar size={15} className="text-[#102B4E] shrink-0" aria-hidden="true" />
                      <span>
                        Posted:{' '}
                        <time dateTime={opp.publishedAt || opp.createdAt} className="font-medium text-[#102B4E]">
                          {pubDateFormatted}
                        </time>
                      </span>
                    </span>
                  )}

                  {pubDateFormatted && deadlineFormatted && (
                    <span className="hidden sm:inline-block h-4 w-px bg-slate-200" aria-hidden="true" />
                  )}

                  {deadlineFormatted && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock
                        size={15}
                        className={cn('shrink-0', isClosed ? 'text-red-600' : 'text-[#102B4E]')}
                        aria-hidden="true"
                      />
                      <span>
                        Deadline:{' '}
                        <span className={cn('font-medium', isClosed ? 'text-red-600 font-semibold' : 'text-[#102B4E]')}>
                          {deadlineFormatted}
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Application Closed Notice */}
              {isClosed && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50/75 p-4 flex items-start gap-3 text-red-900"
                >
                  <AlertCircle size={19} className="text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm leading-relaxed">
                    <p className="font-bold">Application Closed</p>
                    <p className="text-red-800/90 mt-0.5">
                      The application deadline ({deadlineFormatted}) has passed. This opportunity is no longer accepting applications.
                    </p>
                  </div>
                </div>
              )}

              {/* Optional Featured Cover Image */}
              {opp.coverImageUrl && (
                <figure className="mt-5">
                  <button
                    type="button"
                    onClick={() => setZoomedImg(opp.coverImageUrl!)}
                    className="w-full block rounded-xl overflow-hidden border border-slate-200/90 bg-slate-50 relative group cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B57D0]"
                    aria-label="Expand featured job image"
                  >
                    <img
                      src={opp.coverImageUrl}
                      alt={opp.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-auto max-h-[420px] object-contain block mx-auto"
                    />
                    <span className="absolute bottom-2.5 right-2.5 bg-[#102B4E]/80 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 size={14} />
                    </span>
                  </button>
                </figure>
              )}

              {/* Optional Job Summary / Introduction */}
              {opp.summary?.trim() && (
                <p className="mt-5 text-[15px] sm:text-[16px] leading-[1.65] text-slate-700 font-normal">
                  {opp.summary.trim()}
                </p>
              )}

              {/* Experience / Education / Salary Key Info Grid (Only renders provided employer fields) */}
              {structuredHighlights.length > 0 && (
                <section
                  aria-label="Key job details"
                  className="mt-5 rounded-xl bg-slate-50/80 border border-slate-200/80 p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3"
                >
                  {structuredHighlights.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.label} className="flex items-start gap-2.5 min-w-0">
                        <ItemIcon size={16} className="text-[#0B57D0] shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0 text-[13px] sm:text-sm leading-snug">
                          <div className="text-slate-500 font-medium">{item.label}</div>
                          <div className="font-bold text-[#102B4E] break-words mt-0.5">{item.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Job Description & Narrative Sections */}
              <div className="mt-6 space-y-6">
                {hasRichContent(opp.description) && (
                  <section aria-label={overviewHeading}>
                    <h2 className="text-[18px] sm:text-[20px] font-bold text-[#102B4E] mb-2.5">
                      {overviewHeading}
                    </h2>
                    <div
                      className="article-prose max-w-none overflow-x-hidden"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.description) }}
                    />
                  </section>
                )}

                {hasRichContent(opp.responsibilities) && (
                  <section aria-label="Key Responsibilities">
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] mb-2.5">
                      Key Responsibilities
                    </h2>
                    <div
                      className="article-prose max-w-none overflow-x-hidden"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(opp.responsibilities || ''),
                      }}
                    />
                  </section>
                )}

                {(requirementsHtml || qualificationsHtml) && (
                  <section aria-label="Requirements and Qualifications">
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] mb-2.5">
                      {qualificationsHtml && !requirementsHtml
                        ? 'Qualifications'
                        : 'Requirements & Qualifications'}
                    </h2>
                    {requirementsHtml && (
                      <div
                        className="article-prose max-w-none overflow-x-hidden"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(requirementsHtml) }}
                      />
                    )}
                    {qualificationsHtml && (
                      <div
                        className={cn(
                          'article-prose max-w-none overflow-x-hidden',
                          requirementsHtml && 'mt-3'
                        )}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(qualificationsHtml) }}
                      />
                    )}
                  </section>
                )}

                {hasRichContent(opp.skills) && (
                  <section aria-label="Required Skills">
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] mb-2.5 flex items-center gap-2">
                      <Award size={18} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                      <span>Required Skills</span>
                    </h2>
                    <div
                      className="article-prose max-w-none overflow-x-hidden"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.skills || '') }}
                    />
                  </section>
                )}

                {hasRichContent(opp.benefits) && (
                  <section aria-label="Benefits">
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] mb-2.5 flex items-center gap-2">
                      <HeartHandshake size={18} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                      <span>Benefits</span>
                    </h2>
                    <div
                      className="article-prose max-w-none overflow-x-hidden"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opp.benefits || '') }}
                    />
                  </section>
                )}

                {hasRichContent(opp.requiredDocuments) && (
                  <section aria-label="Required Documents">
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] mb-2.5 flex items-center gap-2">
                      <ClipboardCheck size={18} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                      <span>Required Documents</span>
                    </h2>
                    <div
                      className="article-prose max-w-none overflow-x-hidden"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(opp.requiredDocuments || ''),
                      }}
                    />
                  </section>
                )}

                {(instructionsHtml || opp.contactInfo) && (
                  <section
                    id="how-to-apply"
                    aria-label="Application Instructions"
                    className="pt-4 border-t border-slate-200/80 space-y-2.5"
                  >
                    <h2 className="text-[17px] sm:text-[19px] font-bold text-[#102B4E] flex items-center gap-2">
                      <FileText size={18} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                      <span>Application Instructions</span>
                    </h2>
                    {instructionsHtml && (
                      <div
                        className="article-prose max-w-none overflow-x-hidden"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(instructionsHtml) }}
                      />
                    )}
                    {opp.contactInfo && (
                      <p className="text-sm text-slate-700">
                        <span className="font-bold text-[#102B4E]">Contact Information:</span>{' '}
                        {opp.contactInfo}
                      </p>
                    )}
                  </section>
                )}

                {/* Optional Gallery Images */}
                {opp.galleryImages && opp.galleryImages.length > 0 && (
                  <section aria-label="Supporting Photos" className="pt-4 border-t border-slate-200/80 space-y-3">
                    <h2 className="text-[16px] sm:text-[18px] font-bold text-[#102B4E] flex items-center gap-2">
                      <ImageIcon size={17} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                      <span>Supporting Photos</span>
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {opp.galleryImages.map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setZoomedImg(imgUrl)}
                          className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-zoom-in group"
                        >
                          <img
                            src={imgUrl}
                            alt={`${opp.title} photo ${idx + 1}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Full-Width Apply Now Action Section (Hidden when application closed) */}
              {!isClosed && (applyUrlClean || mailtoHref || opp.downloadUrl) && (
                <div className="mt-6 pt-2 space-y-2.5 no-print">
                  {primaryApplyHref && (
                    <a
                      href={primaryApplyHref}
                      target={primaryApplyIsExternal ? '_blank' : undefined}
                      rel={primaryApplyIsExternal ? 'noopener noreferrer' : undefined}
                      onClick={trackApplyClick}
                      className="w-full min-h-[48px] bg-[#0B57D0] hover:bg-[#083D91] text-white px-6 py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2.5 text-[15px] shadow-sm transition-colors"
                    >
                      {primaryApplyIsExternal ? (
                        <Send size={17} aria-hidden="true" />
                      ) : (
                        <Mail size={17} aria-hidden="true" />
                      )}
                      <span>Apply Now</span>
                    </a>
                  )}

                  {applyUrlClean && mailtoHref && (
                    <a
                      href={mailtoHref}
                      onClick={trackApplyClick}
                      className="w-full min-h-[44px] bg-white hover:bg-slate-50 text-[#0B57D0] border border-[#0B57D0]/30 px-5 py-2.5 rounded-xl font-bold inline-flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <Mail size={16} aria-hidden="true" />
                      <span>Apply via Email ({applyEmailClean})</span>
                    </a>
                  )}

                  {opp.downloadUrl && (
                    <a
                      href={
                        opp.downloadUrl.includes('/api/media/')
                          ? `${opp.downloadUrl}${opp.downloadUrl.includes('?') ? '&' : '?'}download=1`
                          : opp.downloadUrl
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 text-[#102B4E] px-5 py-2.5 rounded-xl font-bold inline-flex items-center justify-center gap-2 text-sm transition-colors"
                    >
                      <Download size={16} aria-hidden="true" />
                      <span>Download Official Document</span>
                    </a>
                  )}
                </div>
              )}

              {/* Share This Job Bar (Matches Reference Screenshot) */}
              <div
                className="mt-5 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 no-print"
                role="group"
                aria-label="Share this job"
              >
                <span className="text-sm font-bold text-[#102B4E]">Share this job:</span>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Facebook"
                    className="w-9 h-9 rounded-full bg-[#1877F2] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                  >
                    <Facebook size={16} />
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`${opp.title} at ${opp.organization}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className="w-9 h-9 rounded-full bg-[#111827] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                  >
                    <X size={15} />
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on LinkedIn"
                    className="w-9 h-9 rounded-full bg-[#0077B5] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${opp.title} — ${opp.organization} — ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="w-9 h-9 rounded-full bg-[#25D366] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                  >
                    <WhatsApp size={16} />
                  </a>
                  <a
                    href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}${pinterestMedia ? `&media=${encodeURIComponent(pinterestMedia)}` : ''}&description=${encodeURIComponent(`${opp.title} at ${opp.organization}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Pinterest"
                    className="w-9 h-9 rounded-full bg-[#CB2027] hover:opacity-90 text-white flex items-center justify-center transition-opacity shrink-0"
                  >
                    <Pinterest size={16} />
                  </a>
                </div>
              </div>
            </article>

            {/* Related Jobs Cards Section (Max 4 on mobile, up to 6 on tablet/desktop) */}
            {relatedCardItems.length > 0 && (
              <section aria-label={relatedSectionTitle} className="space-y-4 no-print">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-[#102B4E]">
                    {relatedSectionTitle}
                  </h2>
                  <NavLink
                    to={basePath}
                    className="text-xs sm:text-sm font-bold text-[#0B57D0] hover:underline inline-flex items-center gap-1 shrink-0"
                  >
                    <span>{viewMoreLabel}</span>
                    <ArrowRight size={14} />
                  </NavLink>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {relatedCardItems.map((item, idx) => {
                    const itemDate = safeFormatDate(item.publishedAt || item.createdAt, 'MMM d, yyyy');
                    return (
                      <NavLink
                        key={item.id}
                        to={getOpportunityRoutePath(item)}
                        className={cn(
                          'bg-white border border-slate-200/90 hover:border-[#0B57D0]/50 rounded-2xl p-4 gap-3.5 items-start transition-colors group shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
                          idx >= 4 ? 'hidden md:flex' : 'flex'
                        )}
                      >
                        <RelatedJobLogo logoUrl={item.organizationLogo} organization={item.organization} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <h3 className="text-[15px] font-bold text-[#102B4E] group-hover:text-[#0B57D0] leading-snug line-clamp-2 transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-xs sm:text-[13px] font-semibold text-slate-700 truncate">
                            {item.organization}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                            {item.location?.trim() && (
                              <span className="inline-flex items-center gap-1 min-w-0">
                                <MapPin size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
                                <span className="truncate">{item.location.trim()}</span>
                              </span>
                            )}
                            {item.type?.trim() && (
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Briefcase size={12} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                                <span>{item.type.trim()}</span>
                              </span>
                            )}
                            {itemDate && (
                              <span className="inline-flex items-center gap-1 shrink-0 tabular-nums">
                                <Calendar size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
                                <span>{itemDate}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            )}
          </main>

          {/* RIGHT SIDEBAR (Desktop sidebar; Mobile/Tablet placed naturally below main job info & related jobs) */}
          {(activeSidebarAds.length > 0 || relatedSideItems.length > 0) && (
            <aside
              aria-label="Advertisements and Related Jobs"
              className="w-full min-w-0 space-y-6 no-print"
            >
              {/* A. Vertical Advertisement Banners */}
              {activeSidebarAds.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
                  {activeSidebarAds.map((ad) => (
                    <SidebarAdBanner key={ad.id} ad={ad} />
                  ))}
                </div>
              )}

              {/* B. Quick Related Jobs Sidebar Card (Desktop only to avoid duplication on mobile) */}
              {relatedSideItems.length > 0 && (
                <div className="hidden lg:block border border-slate-200/90 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
                  <h2 className="text-[15px] font-bold text-[#102B4E] flex items-center gap-2 pb-3 border-b border-slate-200">
                    <Briefcase size={17} className="text-[#0B57D0] shrink-0" aria-hidden="true" />
                    <span>{relatedSectionTitle}</span>
                  </h2>

                  <ul className="divide-y divide-slate-100">
                    {relatedSideItems.map((item) => (
                      <li key={item.id}>
                        <NavLink
                          to={getOpportunityRoutePath(item)}
                          className="py-3 flex items-start gap-2.5 group"
                        >
                          <Briefcase
                            size={15}
                            className="text-[#0B57D0] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-[#102B4E] group-hover:text-[#0B57D0] group-hover:underline leading-snug break-words">
                              {item.title}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {item.organization}
                              {item.location ? ` · ${item.location}` : ''}
                            </div>
                          </div>
                        </NavLink>
                      </li>
                    ))}
                  </ul>

                  <NavLink
                    to={basePath}
                    className="mt-2 min-h-[40px] w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#0B57D0] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>{viewMoreLabel}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </NavLink>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Sticky Mobile Apply Now Bar (Hidden on desktop and when application is closed) */}
      {hasStickyApplyBar && primaryApplyHref && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3.5 py-2.5 pb-safe md:hidden shadow-[0_-4px_20px_rgba(15,23,42,0.08)] no-print">
          <a
            href={primaryApplyHref}
            target={primaryApplyIsExternal ? '_blank' : undefined}
            rel={primaryApplyIsExternal ? 'noopener noreferrer' : undefined}
            onClick={trackApplyClick}
            className="w-full min-h-[46px] bg-[#0B57D0] hover:bg-[#083D91] text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-[15px] shadow-sm transition-colors"
          >
            {primaryApplyIsExternal ? (
              <Send size={17} aria-hidden="true" />
            ) : (
              <Mail size={17} aria-hidden="true" />
            )}
            <span>Apply Now</span>
          </a>
        </div>
      )}

      {/* Accessible Image Lightbox */}
      {zoomedImg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded job image"
          onClick={() => setZoomedImg(null)}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setZoomedImg(null)}
            aria-label="Close image preview"
            className="absolute top-4 right-4 min-h-[44px] min-w-[44px] flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
          >
            <CloseIcon size={22} />
          </button>
          <img
            src={zoomedImg}
            alt={opp.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] rounded-lg object-contain cursor-default"
          />
        </div>
      )}
    </div>
  );
}
