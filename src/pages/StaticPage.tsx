import React from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WebPage } from '../types';
import { useParams, useLocation, NavLink } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { useSettings } from '../lib/SettingsContext';

const DEFAULT_PAGES: Record<string, { title: string; content: string }> = {
  about: {
    title: 'About Rwanda Opportunities',
    content: `
      <p><strong>Rwanda Opportunities</strong> is Rwanda's trusted digital platform connecting citizens, students, professionals, and businesses with verified news, career openings, scholarships, public tenders, and development programs.</p>
      <h2>Our Mission</h2>
      <p>We bridge the information gap by delivering timely Kinyarwanda and English news alongside curated local and international opportunities so every Rwandan can take their next big step with confidence.</p>
      <h2>What We Offer</h2>
      <ul>
        <li><strong>Verified News:</strong> Timely reporting in Kinyarwanda and English covering economy, infrastructure, education, and technology.</li>
        <li><strong>Jobs &amp; Careers:</strong> Public sector, private industry, NGO, and international vacancies.</li>
        <li><strong>Scholarships:</strong> Local and global undergraduate, Master's, and PhD funding announcements.</li>
        <li><strong>Tenders &amp; Grants:</strong> Transparent procurement notices, fellowships, workshops, and business opportunities.</li>
      </ul>
    `
  },
  privacy: {
    title: 'Privacy Policy',
    content: `
      <p>Your privacy is important to us at <strong>Rwanda Opportunities</strong>. This policy explains what information we collect and how we protect it.</p>
      <h2>Information We Collect</h2>
      <p>We collect email addresses voluntarily submitted through our newsletter subscription and contact forms, as well as anonymous page-view analytics to improve platform performance.</p>
      <h2>How We Use Information</h2>
      <p>Submitted contact details are used solely to respond to inquiries or deliver requested opportunity updates. We never sell or rent personal information to third parties.</p>
      <h2>Contact</h2>
      <p>For privacy inquiries, please reach out via our <a href="/contact">Contact page</a>.</p>
    `
  },
  terms: {
    title: 'Terms of Use',
    content: `
      <p>By accessing and using <strong>Rwanda Opportunities</strong>, you agree to comply with these Terms of Use.</p>
      <h2>Accuracy of Listings</h2>
      <p>While we strive to verify all job vacancies, scholarships, and tender notices, applicants should always review official deadlines and submission guidelines on the issuing organization's official portal.</p>
      <h2>Permitted Use</h2>
      <p>Content published on this platform is intended for informational and personal career/educational advancement purposes.</p>
    `
  }
};

export function StaticPage() {
  const { slug } = useParams();
  const location = useLocation();
  const { settings } = useSettings();
  const [page, setPage] = React.useState<WebPage | null>(null);
  const [loading, setLoading] = React.useState(true);

  const resolvedSlug = React.useMemo(() => {
    if (slug) return slug.toLowerCase();
    const cleanPath = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    return cleanPath || 'about';
  }, [slug, location.pathname]);

  React.useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setPage(null);
      try {
        const q = query(
          collection(db, 'pages'),
          where('status', '==', 'published'),
          where('slug', '==', resolvedSlug),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPage({ id: snap.docs[0].id, ...snap.docs[0].data() } as WebPage);
        } else if (DEFAULT_PAGES[resolvedSlug]) {
          setPage({
            id: resolvedSlug,
            slug: resolvedSlug,
            title: DEFAULT_PAGES[resolvedSlug].title,
            content: DEFAULT_PAGES[resolvedSlug].content,
            status: 'published',
            lastUpdated: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error(e);
        if (DEFAULT_PAGES[resolvedSlug]) {
          setPage({
            id: resolvedSlug,
            slug: resolvedSlug,
            title: DEFAULT_PAGES[resolvedSlug].title,
            content: DEFAULT_PAGES[resolvedSlug].content,
            status: 'published',
            lastUpdated: new Date().toISOString()
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
    window.scrollTo(0, 0);
  }, [resolvedSlug]);

  if (loading) return <div className="p-20 text-center animate-pulse">Loading...</div>;

  if (!page) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-6">Page Not Found</h1>
      <p className="text-slate-500 mb-8">The page you are looking for might have been moved or deleted.</p>
      <NavLink to="/" className="bg-[#083D91] text-white px-8 py-3 rounded-xl font-bold inline-block">Return Home</NavLink>
    </div>
  );

  return (
    <div className="bg-white min-h-screen py-16 md:py-20">
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-3">{settings.websiteName}</p>
        <h1 className="text-3xl md:text-5xl font-extrabold text-[#102B4E] font-montserrat mb-10 border-b border-slate-100 pb-8">{page.title}</h1>
        <div
          className="prose prose-slate lg:prose-xl max-w-none prose-headings:text-[#102B4E] prose-a:text-teal-600"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
        />
      </div>
    </div>
  );
}
