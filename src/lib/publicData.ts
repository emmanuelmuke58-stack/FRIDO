import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { CategoryItem, NewsItem, Opportunity } from '../types';
import { safeDate } from './utils';

export const PUBLIC_DATA_UPDATED_EVENT = 'rw-public-data-updated';
const CACHE_TTL_MS = 30_000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PublicCounts {
  news: number;
  jobs: number;
  scholarships: number;
  tenders: number;
  others: number;
  totalOpportunities: number;
}

export interface PublicPortalData {
  news: NewsItem[];
  opportunities: Opportunity[];
  jobs: Opportunity[];
  scholarships: Opportunity[];
  tenders: Opportunity[];
  others: Opportunity[];
  categories: CategoryItem[];
  counts: PublicCounts;
  locations: string[];
  fetchedAt: number;
}

let cachedData: PublicPortalData | null = null;
let inFlightPromise: Promise<PublicPortalData> | null = null;

export function invalidatePublicCache() {
  cachedData = null;
  inFlightPromise = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PUBLIC_DATA_UPDATED_EVENT));
    try {
      if ('BroadcastChannel'in window) {
        const bc = new BroadcastChannel('rw_public_data');
        bc.postMessage({ type: 'invalidate', at: Date.now() });
        bc.close();
      }
    } catch {
      // ignore if BroadcastChannel unavailable
    }
  }
}

export function isNewsPubliclyVisible(item: NewsItem, now: Date = new Date()): boolean {
  if (item.status !== 'published') return false;
  if (!item.publishedAt) return true;
  const pubDate = safeDate(item.publishedAt);
  if (!pubDate) return true;
  return pubDate.getTime() <= now.getTime();
}

export function isOpportunityExpired(opp: Opportunity, now: Date = new Date()): boolean {
  if (opp.status !== 'active') return true;
  if (!opp.deadline) return false;
  const parsed = safeDate(opp.deadline);
  if (!parsed) return false;

  // Date-only strings (YYYY-MM-DD) remain active through the end of that day
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(opp.deadline).trim())) {
    const endOfDay = new Date(parsed);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime() < now.getTime();
  }
  return parsed.getTime() < now.getTime();
}

export function calculateReadingTime(htmlOrText?: string): number {
  if (!htmlOrText) return 1;
  const plain = htmlOrText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plain ? plain.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

export function getOpportunityRoutePath(opp: Pick<Opportunity, 'category'| 'slug'>): string {
  const base = opp.category === 'Others'? 'opportunities': opp.category.toLowerCase();
  return `/${base}/${opp.slug}`;
}

export async function fetchPublicPortalData(forceRefresh = false): Promise<PublicPortalData> {
  const nowTs = Date.now();
  if (!forceRefresh && cachedData && nowTs - cachedData.fetchedAt < CACHE_TTL_MS) {
    return cachedData;
  }
  if (!forceRefresh && inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    const now = new Date();
    const [newsSnap, oppSnap, catSnap] = await Promise.all([
      getDocs(query(collection(db, 'news'), where('status', '==', 'published'))),
      getDocs(query(collection(db, 'opportunities'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'categories'), where('status', '==', 'active'))),
    ]);

    const news = newsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as NewsItem))
      .filter((item) => isNewsPubliclyVisible(item, now))
      .sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

    const opportunities = oppSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Opportunity))
      .filter((opp) => !isOpportunityExpired(opp, now))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const categories = catSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as CategoryItem))
      .filter((cat) => cat.status === 'active');

    const jobs = opportunities.filter((o) => o.category === 'Jobs');
    const scholarships = opportunities.filter((o) => o.category === 'Scholarships');
    const tenders = opportunities.filter((o) => o.category === 'Tenders');
    const others = opportunities.filter((o) => o.category === 'Others');

    const locationSet = new Set<string>();
    opportunities.forEach((o) => {
      if (o.location?.trim()) locationSet.add(o.location.trim());
    });

    const data: PublicPortalData = {
      news,
      opportunities,
      jobs,
      scholarships,
      tenders,
      others,
      categories,
      counts: {
        news: news.length,
        jobs: jobs.length,
        scholarships: scholarships.length,
        tenders: tenders.length,
        others: others.length,
        totalOpportunities: opportunities.length,
      },
      locations: Array.from(locationSet).sort((a, b) => a.localeCompare(b)),
      fetchedAt: Date.now(),
    };

    cachedData = data;
    return data;
  })();

  try {
    return await inFlightPromise;
  } finally {
    inFlightPromise = null;
  }
}

async function hashEmailToDocId(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (typeof window !== 'undefined'&& window.crypto?.subtle) {
    const encoded = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic 64-char hex string
  let h1 = 0x811c9dc5;
  let h2 = 0xdeadbeef;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b);
  }
  const part = `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
  return part.repeat(4).slice(0, 64);
}

export async function subscribeToNewsletter(rawEmail: string): Promise<{ status: 'subscribed'| 'reactivated'| 'already_subscribed'; message: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const docId = await hashEmailToDocId(email);
  const ref = doc(db, 'subscribers', docId);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();
    if (data.status === 'active') {
      return {
        status: 'already_subscribed',
        message: 'This email address is already subscribed to our newsletter.',
      };
    }
    await updateDoc(ref, {
      status: 'active',
      subscribedAt: new Date().toISOString(),
    });
    return {
      status: 'reactivated',
      message: 'Welcome back! Your newsletter subscription has been reactivated.',
    };
  }

  await setDoc(ref, {
    email,
    subscribedAt: new Date().toISOString(),
    status: 'active',
  });

  return {
    status: 'subscribed',
    message: 'Thank you for subscribing! You will receive verified updates in your inbox.',
  };
}

export async function unsubscribeFromNewsletter(rawEmail: string): Promise<{ message: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const docId = await hashEmailToDocId(email);
  const ref = doc(db, 'subscribers', docId);
  const existing = await getDoc(ref);

  if (!existing.exists() || existing.data()?.status === 'unsubscribed') {
    return {
      message: 'No active subscription was found for that email address.',
    };
  }

  await updateDoc(ref, {
    status: 'unsubscribed',
  });

  return {
    message: 'You have been unsubscribed from Rwanda Opportunities alerts.',
  };
}
