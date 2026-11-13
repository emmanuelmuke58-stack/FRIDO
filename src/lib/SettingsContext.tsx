import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { STATIC_ASSETS, resolveAssetUrl } from './assets';
import { HeroSlide, HomepageConfig, HomepageSectionConfig } from '../types';
import { invalidatePublicCache } from './publicData';

export interface WebsiteSettings {
  websiteName: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  trashRetentionDays?: number;
  socialLinks: {
    facebook: string;
    twitter: string;
    linkedin: string;
    youtube: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
  };
  heroSlides: HeroSlide[];
  homepage: HomepageConfig;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionConfig[] = [
  {
    id: 'featured',
    enabled: true,
    title: 'Featured Opportunities',
    description: 'Hand-picked verified openings across jobs, scholarships, and tenders.',
    limit: 4,
    order: 1,
  },
  {
    id: 'search',
    enabled: true,
    title: 'Search Verified News & Active Opportunities',
    description: 'Filter live opportunities and news across categories, locations, and languages.',
    limit: 6,
    order: 2,
  },
  {
    id: 'news',
    enabled: true,
    title: 'Latest News from Rwanda',
    description: 'Verified Kinyarwanda and English reporting across economy, education, and technology.',
    limit: 4,
    order: 3,
  },
  {
    id: 'jobs',
    enabled: true,
    title: 'Find Your Next Career Opportunity',
    description: 'Active vacancies from public institutions, NGOs, and private sector employers.',
    limit: 4,
    order: 4,
  },
  {
    id: 'promos',
    enabled: true,
    title: 'Spotlight Categories',
    description: 'Quick portals into education funding and business tenders.',
    limit: 2,
    order: 5,
  },
  {
    id: 'scholarships',
    enabled: true,
    title: 'Latest Scholarships & Study Programs',
    description: 'Local and international undergraduate, Master’s, and PhD funding opportunities.',
    limit: 4,
    order: 6,
  },
  {
    id: 'tenders',
    enabled: true,
    title: 'Latest Tenders & Business Notices',
    description: 'Government procurement and private-sector business opportunities.',
    limit: 4,
    order: 7,
  },
  {
    id: 'others',
    enabled: true,
    title: 'Internships, Fellowships & Grants',
    description: 'Capacity building, fellowships, workshops, and funding grants.',
    limit: 4,
    order: 8,
  },
  {
    id: 'cta',
    enabled: true,
    title: 'Your Future Starts With the Right Opportunity.',
    description: 'Explore verified jobs, scholarships, tenders, and development programs tailored for Rwanda.',
    limit: 1,
    order: 9,
  },
];

export const DEFAULT_SETTINGS: WebsiteSettings = {
  websiteName: 'Rwanda Opportunities',
  logoUrl: STATIC_ASSETS.rwandaLogoGraphic,
  faviconUrl: '',
  contactEmail: 'info@rwandaopportunities.com',
  contactPhone: '+250 788 000 000',
  address: 'Kigali, Rwanda',
  trashRetentionDays: 30,
  socialLinks: {
    facebook: 'https://facebook.com',
    twitter: 'https://twitter.com',
    linkedin: 'https://linkedin.com',
    youtube: 'https://youtube.com',
  },
  seo: {
    defaultTitle: 'Rwanda Opportunities - More Opportunities. A Stronger Rwanda.',
    defaultDescription: 'Your trusted source for verified news, job vacancies, scholarships, tenders, and opportunities in Rwanda and beyond.',
  },
  heroSlides: [
    {
      id: 'slide-platform-1',
      category: 'RWANDA OPPORTUNITIES',
      title: 'Discover Opportunities. Build Your Future.',
      description: 'Explore the latest verified news, jobs, scholarships, tenders and opportunities in Rwanda and around the world.',
      buttonText: 'Explore Opportunities',
      link: '/opportunities',
      secondaryButtonText: 'Latest News',
      secondaryLink: '/news',
      image: STATIC_ASSETS.kigaliPanoramaHero,
      status: 'published',
      order: 1,
      featuredType: 'custom',
    },
    {
      id: 'slide-platform-2',
      category: 'RWANDA CAREERS & TENDERS',
      title: 'Accelerate Your Career & Business Growth',
      description: 'Connect directly with verified employers, international academic funding, and public procurement tenders.',
      buttonText: 'Browse Active Jobs',
      link: '/jobs',
      secondaryButtonText: 'View Tenders',
      secondaryLink: '/tenders',
      image: STATIC_ASSETS.rwandaInfrastructure,
      status: 'published',
      order: 2,
      featuredType: 'custom',
    },
  ],
  homepage: {
    sections: DEFAULT_HOMEPAGE_SECTIONS,
    featuredNewsIds: [],
    featuredOpportunityIds: [],
    promoBanners: {
      education: {
        title: 'Invest in Your Education',
        description: 'Explore verified local and international scholarships for your academic journey.',
        buttonText: 'View Scholarships',
        link: '/scholarships',
        image: STATIC_ASSETS.rwandaGraduation,
      },
      tenders: {
        title: 'Latest Tenders & Business Opportunities',
        description: 'Discover active government procurement notices and private-sector business tenders.',
        buttonText: 'View Tenders',
        link: '/tenders',
        image: STATIC_ASSETS.rwandaInfrastructure,
      },
      cta: {
        title: 'Your Future Starts With the Right Opportunity.',
        description: 'Browse verified jobs, scholarships, tenders, fellowships, and national news updated daily.',
        buttonText: 'Explore Opportunities',
        link: '/opportunities',
        image: STATIC_ASSETS.rwandaEducationBanner,
      },
    },
  },
};

const SettingsContext = createContext<{
  settings: WebsiteSettings;
  updateSettings: (newSettings: WebsiteSettings) => Promise<void>;
  loading: boolean;
}>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  loading: true,
});

function mergeSections(incoming?: HomepageSectionConfig[]): HomepageSectionConfig[] {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return DEFAULT_HOMEPAGE_SECTIONS;
  }
  const byId = new Map(incoming.map((s) => [s.id, s]));
  const merged = DEFAULT_HOMEPAGE_SECTIONS.map((def) => {
    const custom = byId.get(def.id);
    return custom ? { ...def, ...custom } : def;
  });
  return merged.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

function normalizeSettings(raw: Partial<WebsiteSettings>): WebsiteSettings {
  const merged = { ...DEFAULT_SETTINGS, ...raw } as WebsiteSettings;
  const rawSlides = Array.isArray(raw.heroSlides) && raw.heroSlides.length > 0
    ? raw.heroSlides
    : DEFAULT_SETTINGS.heroSlides;

  return {
    ...merged,
    socialLinks: {
      ...DEFAULT_SETTINGS.socialLinks,
      ...(raw.socialLinks || {}),
    },
    seo: {
      ...DEFAULT_SETTINGS.seo,
      ...(raw.seo || {}),
    },
    logoUrl: resolveAssetUrl(merged.logoUrl, STATIC_ASSETS.rwandaLogoGraphic),
    heroSlides: rawSlides
      .map((slide, idx) => ({
        ...slide,
        id: slide.id || `slide-${idx + 1}`,
        status: slide.status || 'published',
        order: typeof slide.order === 'number'? slide.order : idx + 1,
        image: resolveAssetUrl(slide.image, STATIC_ASSETS.kigaliPanoramaHero),
      }))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    homepage: {
      sections: mergeSections(raw.homepage?.sections),
      featuredNewsIds: raw.homepage?.featuredNewsIds || [],
      featuredOpportunityIds: raw.homepage?.featuredOpportunityIds || [],
      promoBanners: {
        education: {
          ...DEFAULT_SETTINGS.homepage.promoBanners!.education,
          ...(raw.homepage?.promoBanners?.education || {}),
          image: resolveAssetUrl(
            raw.homepage?.promoBanners?.education?.image,
            STATIC_ASSETS.rwandaGraduation
          ),
        },
        tenders: {
          ...DEFAULT_SETTINGS.homepage.promoBanners!.tenders,
          ...(raw.homepage?.promoBanners?.tenders || {}),
          image: resolveAssetUrl(
            raw.homepage?.promoBanners?.tenders?.image,
            STATIC_ASSETS.rwandaInfrastructure
          ),
        },
        cta: {
          ...DEFAULT_SETTINGS.homepage.promoBanners!.cta,
          ...(raw.homepage?.promoBanners?.cta || {}),
          image: resolveAssetUrl(
            raw.homepage?.promoBanners?.cta?.image,
            STATIC_ASSETS.rwandaEducationBanner
          ),
        },
      },
    },
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const merged = normalizeSettings(snap.data() as Partial<WebsiteSettings>);
          setSettings(merged);
          if (merged.seo?.defaultTitle) {
            document.title = merged.seo.defaultTitle;
          }
          if (merged.faviconUrl) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
            if (!link) {
              link = document.createElement('link');
              link.rel = 'icon';
              document.head.appendChild(link);
            }
            link.href = merged.faviconUrl;
          }
        } else if (auth.currentUser) {
          setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS).catch(() => {});
        }
        setLoading(false);
      },
      (error) => {
        console.error('Settings snapshot error:', error);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const updateSettings = async (newSettings: WebsiteSettings) => {
    await setDoc(doc(db, 'settings', 'global'), newSettings);
    invalidatePublicCache();
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
