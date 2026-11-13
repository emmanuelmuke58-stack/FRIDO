import React from 'react';
import { Hero, CategoryCards } from '@/src/components/home/Hero';
import { HomepageSearch } from '@/src/components/home/HomepageSearch';
import { FeaturedOpportunitiesSection } from '@/src/components/home/FeaturedOpportunitiesSection';
import { LatestNewsBlock, LatestJobsBlock } from '@/src/components/home/NewsAndJobsSplitSection';
import {
  ScholarshipsSection,
  TendersSection,
  OtherOpportunitiesSection,
} from '@/src/components/home/ModulesShowcaseSection';
import { PromoSpotlightCards, PromotionalBanner } from '@/src/components/home/PromotionalBanners';
import { useSettings, DEFAULT_HOMEPAGE_SECTIONS } from '@/src/lib/SettingsContext';
import {
  fetchPublicPortalData,
  PublicPortalData,
  PUBLIC_DATA_UPDATED_EVENT,
} from '@/src/lib/publicData';
import { HomepageSectionConfig } from '@/src/types';

const EMPTY_PORTAL_DATA: PublicPortalData = {
  news: [],
  opportunities: [],
  jobs: [],
  scholarships: [],
  tenders: [],
  others: [],
  categories: [],
  counts: {
    news: 0,
    jobs: 0,
    scholarships: 0,
    tenders: 0,
    others: 0,
    totalOpportunities: 0,
  },
  locations: [],
  fetchedAt: 0,
};

export function HomePage() {
  const { settings } = useSettings();
  const [data, setData] = React.useState<PublicPortalData>(EMPTY_PORTAL_DATA);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async (force = false) => {
    try {
      const result = await fetchPublicPortalData(force);
      setData(result);
    } catch (e) {
      console.error('Failed to load homepage data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();

    const handleInvalidate = () => loadData(true);
    window.addEventListener(PUBLIC_DATA_UPDATED_EVENT, handleInvalidate);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined'&& 'BroadcastChannel'in window) {
      try {
        bc = new BroadcastChannel('rw_public_data');
        bc.onmessage = () => loadData(true);
      } catch {
        // ignore
      }
    }

    return () => {
      window.removeEventListener(PUBLIC_DATA_UPDATED_EVENT, handleInvalidate);
      if (bc) bc.close();
    };
  }, [loadData]);

  const orderedSections = React.useMemo(() => {
    const list =
      settings.homepage?.sections && settings.homepage.sections.length > 0
        ? settings.homepage.sections
        : DEFAULT_HOMEPAGE_SECTIONS;
    return [...list]
      .filter((s) => s.enabled !== false)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }, [settings.homepage?.sections]);

  // Group adjacent 'news'and 'jobs'sections into the signature 2-column split editorial band
  const renderedBlocks: React.ReactNode[] = [];
  for (let i = 0; i < orderedSections.length; i++) {
    const sec: HomepageSectionConfig = orderedSections[i];
    const next = orderedSections[i + 1];

    if (sec.id === 'news'&& next?.id === 'jobs') {
      renderedBlocks.push(
        <section key="split-news-jobs" className="bg-white py-10 md:py-14 px-4 sm:px-6 border-t border-slate-100">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-7">
              <LatestNewsBlock config={sec} news={data.news} loading={loading} />
            </div>
            <div className="lg:col-span-5">
              <LatestJobsBlock config={next} jobs={data.jobs} loading={loading} />
            </div>
          </div>
        </section>
      );
      i++; // consumed next
      continue;
    }

    switch (sec.id) {
      case 'featured':
        renderedBlocks.push(
          <FeaturedOpportunitiesSection
            key="featured" config={sec}
            opportunities={data.opportunities}
            featuredIds={settings.homepage?.featuredOpportunityIds}
            loading={loading}
          />
        );
        break;
      case 'search':
        renderedBlocks.push(
          <HomepageSearch
            key="search" config={sec}
            news={data.news}
            opportunities={data.opportunities}
            categories={data.categories}
            locations={data.locations}
          />
        );
        break;
      case 'news':
        renderedBlocks.push(
          <section key="news" className="bg-white py-10 md:py-14 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <LatestNewsBlock config={sec} news={data.news} loading={loading} />
            </div>
          </section>
        );
        break;
      case 'jobs':
        renderedBlocks.push(
          <section key="jobs" className="bg-white py-10 md:py-14 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <LatestJobsBlock config={sec} jobs={data.jobs} loading={loading} />
            </div>
          </section>
        );
        break;
      case 'scholarships':
        renderedBlocks.push(
          <ScholarshipsSection
            key="scholarships" config={sec}
            scholarships={data.scholarships}
            loading={loading}
          />
        );
        break;
      case 'tenders':
        renderedBlocks.push(
          <TendersSection
            key="tenders" config={sec}
            tenders={data.tenders}
            loading={loading}
          />
        );
        break;
      case 'others':
        renderedBlocks.push(
          <OtherOpportunitiesSection
            key="others" config={sec}
            others={data.others}
            loading={loading}
          />
        );
        break;
      case 'promos':
        renderedBlocks.push(<PromoSpotlightCards key="promos"/>);
        break;
      case 'cta':
        renderedBlocks.push(<PromotionalBanner key="cta"/>);
        break;
      default:
        break;
    }
  }

  return (
    <div className="bg-white">
      <Hero />
      <CategoryCards counts={data.counts} loading={loading} />
      {renderedBlocks}
    </div>
  );
}
