import React, { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { X, Search, Image as ImageIcon, Plus, Check } from 'lucide-react';
import { logActivity } from '../../lib/services';

interface MediaItem {
  id: string;
  url: string;
  name: string;
  createdAt: string;
}

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export function MediaPickerModal({ isOpen, onClose, onSelect }: MediaPickerModalProps) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setMedia(snap.docs.map(d => ({ id: d.id, ...d.data() } as MediaItem)));
    } catch (e) {
      console.error('Failed to load media library:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMedia();
    }
  }, [isOpen]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    setAdding(true);
    try {
      await addDoc(collection(db, 'media'), {
        name: newName.trim(),
        url: newUrl.trim(),
        createdAt: new Date().toISOString()
      });
      await logActivity('settings', 'create', `Added media: ${newName.trim()}`);
      onSelect(newUrl.trim());
      setNewName('');
      setNewUrl('');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to add media item.');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  const filtered = media.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#102B4E]">Media Library</h3>
              <p className="text-xs text-slate-400">Select an existing image or add a new image URL.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <form onSubmit={handleQuickAdd} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <input
              type="text"
              placeholder="Image label (e.g. Kigali City)"
              className="md:col-span-4 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              type="url"
              placeholder="Paste image URL (https://...)"
              className="md:col-span-6 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:border-teal-500"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
            />
            <button
              type="submit"
              disabled={adding || !newName.trim() || !newUrl.trim()}
              className="md:col-span-2 bg-[#083D91] hover:bg-[#07366D] text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus size={16} /> Save & Use
            </button>
          </form>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search saved media..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading media library...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 italic">
              No media items found. Add an image URL above to get started.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.url);
                    onClose();
                  }}
                  className="group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-teal-500 hover:shadow-lg transition-all"
                >
                  <div className="aspect-video bg-slate-100 relative overflow-hidden">
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow">
                        <Check size={14} /> Select
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
