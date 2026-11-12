import React from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { WebPage } from '../types';
import { useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';

export function StaticPage() {
  const { slug } = useParams();
  const [page, setPage] = React.useState<WebPage | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchPage = async () => {
      try {
        const q = query(collection(db, 'pages'), where('slug', '==', slug || 'about'), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setPage({ id: snap.docs[0].id, ...snap.docs[0].data() } as WebPage);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchPage();
  }, [slug]);

  if (loading) return <div className="p-20 text-center animate-pulse">Loading...</div>;

  if (!page) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-6">Page Not Found</h1>
      <p className="text-slate-500 mb-8">The page you are looking for might have been moved or deleted.</p>
      <a href="/" className="bg-[#083D91] text-white px-8 py-3 rounded-xl font-bold">Return Home</a>
    </div>
  );

  return (
    <div className="bg-white min-h-screen py-20">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-5xl font-extrabold text-[#102B4E] font-montserrat mb-12 border-b border-slate-100 pb-8">{page.title}</h1>
        <div 
          className="prose prose-slate lg:prose-xl max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
        />
      </div>
    </div>
  );
}
