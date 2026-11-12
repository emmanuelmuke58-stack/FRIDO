import React from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { NewsItem, Opportunity } from '@/src/types';
import { Layout } from '../components/layout/Layout';
import { Plus, Trash, Edit, Save, LogOut } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

export function AdminPage() {
  const [user, setUser] = React.useState(auth.currentUser);
  const [news, setNews] = React.useState<NewsItem[]>([]);
  const [opps, setOpps] = React.useState<Opportunity[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        fetchData();
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const fetchData = async () => {
    try {
      const newsSnap = await getDocs(query(collection(db, 'news'), orderBy('publishedAt', 'desc')));
      const oppsSnap = await getDocs(query(collection(db, 'opportunities'), orderBy('createdAt', 'desc')));
      
      setNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsItem)));
      setOpps(oppsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Opportunity)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
        <button 
          onClick={login}
          className="bg-[#083D91] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#07366D] transition-all"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-slate-500 text-sm">Access restricted to authorized personnel.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-12">
        <h1 className="text-3xl font-bold text-[#102B4E]">Admin Dashboard</h1>
        <button onClick={logout} className="flex items-center gap-2 text-red-500 font-bold hover:underline">
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* News Management */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Manage News</h2>
            <button className="bg-teal-500 text-white p-2 rounded-lg hover:bg-teal-600 transition-all">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {news.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 border-b border-slate-50">
                <span className="text-sm font-medium truncate max-w-[250px]">{item.headline}</span>
                <div className="flex gap-2">
                  <button className="text-slate-400 hover:text-teal-600"><Edit size={16} /></button>
                  <button className="text-slate-400 hover:text-red-600"><Trash size={16} /></button>
                </div>
              </div>
            ))}
            {news.length === 0 && <p className="text-slate-400 text-sm italic">No news articles yet.</p>}
          </div>
        </section>

        {/* Opportunity Management */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Manage Opportunities</h2>
            <button className="bg-[#083D91] text-white p-2 rounded-lg hover:bg-[#07366D] transition-all">
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {opps.map(opp => (
              <div key={opp.id} className="flex items-center justify-between p-3 border-b border-slate-50">
                <span className="text-sm font-medium truncate max-w-[250px]">{opp.title}</span>
                <div className="flex gap-2">
                  <button className="text-slate-400 hover:text-teal-600"><Edit size={16} /></button>
                  <button className="text-slate-400 hover:text-red-600"><Trash size={16} /></button>
                </div>
              </div>
            ))}
            {opps.length === 0 && <p className="text-slate-400 text-sm italic">No opportunities listed.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
