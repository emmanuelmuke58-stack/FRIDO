import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Plus, Trash2, Copy, ExternalLink, Image as ImageIcon, Search, X } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

interface MediaItem {
  id: string;
  url: string;
  name: string;
  createdAt: string;
}

export function MediaManagement() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setAdding] = useState(false);
  const [newMedia, setNewMedia] = useState({ url: '', name: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedia.url || !newMedia.name) return;
    try {
      await addDoc(collection(db, 'media'), {
        ...newMedia,
        createdAt: new Date().toISOString()
      });
      await logActivity('settings', 'create', `Added media: ${newMedia.name}`);
      setNewMedia({ url: '', name: '' });
      setAdding(false);
      fetchMedia();
    } catch (e) {
      alert('Failed to add media');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  };

  const filteredMedia = media.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Media Library</h1>
          <p className="text-slate-500 mt-1">Manage and access image URLs for your articles.</p>
        </div>
        <button 
          onClick={() => setAdding(true)}
          className="bg-teal-500 hover:bg-teal-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all"
        >
          <Plus size={20} /> Add Media URL
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-3xl border-2 border-teal-100 shadow-xl animate-in zoom-in-95 duration-300">
           <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Add New Media</h3>
              <button onClick={() => setAdding(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
           </div>
           <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Media Name / Description</label>
                <input required className="w-full p-4 bg-slate-50 rounded-2xl text-sm" placeholder="e.g. Kigali Skyline" value={newMedia.name} onChange={e => setNewMedia({...newMedia, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Direct Image URL</label>
                <input required className="w-full p-4 bg-slate-50 rounded-2xl text-sm font-mono" placeholder="https://..." value={newMedia.url} onChange={e => setNewMedia({...newMedia, url: e.target.value})} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                 <button type="submit" className="bg-[#083D91] text-white px-8 py-3 rounded-xl font-bold">Save Media</button>
              </div>
           </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search media..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredMedia.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-all">
            <div className="aspect-square bg-slate-50 relative overflow-hidden">
               <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button onClick={() => copyUrl(item.url)} className="p-2 bg-white rounded-lg text-slate-900 shadow-lg hover:scale-110 transition-transform"><Copy size={18} /></button>
                  <a href={item.url} target="_blank" rel="noreferrer" className="p-2 bg-white rounded-lg text-slate-900 shadow-lg hover:scale-110 transition-transform"><ExternalLink size={18} /></a>
               </div>
            </div>
            <div className="p-4">
               <p className="text-sm font-bold text-slate-900 truncate mb-1">{item.name}</p>
               <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400">{format(new Date(item.createdAt), 'MMM dd, yyyy')}</span>
                  <button 
                    onClick={() => { if(window.confirm('Delete media?')){ deleteDoc(doc(db, 'media', item.id)); fetchMedia(); } }}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
               </div>
            </div>
          </div>
        ))}
      </div>
      
      {!loading && filteredMedia.length === 0 && (
        <div className="p-20 text-center text-slate-400 italic">No media found.</div>
      )}
    </div>
  );
}
