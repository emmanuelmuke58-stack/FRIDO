import React, { createContext, useContext } from 'react';
import {
  BarChart3, Newspaper, Briefcase, GraduationCap, ClipboardList,
  Users, Mail, Settings, History, PieChart, FileText, ExternalLink,
  Search, Bell, LogOut, Menu, X, Image as ImageIcon, FolderTree, Trash2, Layout as LayoutIcon,
  Camera
} from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { logActivity, TRASH_UPDATED_EVENT } from '../../lib/services';
import { cn, extractErrorMessage } from '../../lib/utils';
import { useSettings } from '../../lib/SettingsContext';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { AdminUser } from '../../types';
import { ImageUploadField } from '../../components/admin/ImageUploadField';

interface AdminAuthContextValue {
  userProfile: AdminUser | null;
  userRole: string | null;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  userProfile: null,
  userRole: null,
});

export const useAdminAuth = () => useContext(AdminAuthContext);

const SIDEBAR_ITEMS = [
  { name: 'Overview', path: '/admin', icon: BarChart3 },
  { name: 'News', path: '/admin/news', icon: Newspaper, modKey: 'News'},
  { name: 'Jobs', path: '/admin/jobs', icon: Briefcase, modKey: 'Jobs'},
  { name: 'Scholarships', path: '/admin/scholarships', icon: GraduationCap, modKey: 'Scholarships'},
  { name: 'Tenders', path: '/admin/tenders', icon: ClipboardList, modKey: 'Tenders'},
  { name: 'Other Opportunities', path: '/admin/opportunities', icon: ExternalLink, modKey: 'Others'},
  { name: 'Categories', path: '/admin/categories', icon: FolderTree, role: 'admin'},
  { name: 'Pages', path: '/admin/pages', icon: FileText, role: 'admin'},
  { name: 'Media Library', path: '/admin/media', icon: ImageIcon, role: 'editor'},
  { name: 'Users', path: '/admin/users', icon: Users, role: 'super_admin'},
  { name: 'Newsletter', path: '/admin/newsletter', icon: Mail, role: 'admin'},
  { name: 'Reports & Analytics', path: '/admin/reports', icon: PieChart, role: 'admin'},
  { name: 'Trash / Recycle Bin', path: '/admin/trash', icon: Trash2, role: 'editor', isTrash: true },
  { name: 'Activity Logs', path: '/admin/logs', icon: History, role: 'admin'},
  { name: 'Homepage Management', path: '/admin/homepage', icon: LayoutIcon, role: 'admin'},
  { name: 'Settings', path: '/admin/settings', icon: Settings, role: 'super_admin'},
];

export function AdminLayout() {
  const { settings } = useSettings();
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [userProfile, setUserProfile] = React.useState<AdminUser | null>(null);
  const [authChecking, setAuthChecking] = React.useState(true);
  const [trashCount, setTrashCount] = React.useState(0);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [profileNameDraft, setProfileNameDraft] = React.useState('');
  const [profileAvatarDraft, setProfileAvatarDraft] = React.useState('');
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [avatarImgError, setAvatarImgError] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshTrashCount = React.useCallback(async () => {
    if (!auth.currentUser) return;
    try {
      const [n, o, p, c] = await Promise.all([
        getDocs(query(collection(db, 'news'), where('status', '==', 'deleted'))),
        getDocs(query(collection(db, 'opportunities'), where('status', '==', 'deleted'))),
        getDocs(query(collection(db, 'pages'), where('status', '==', 'deleted'))),
        getDocs(query(collection(db, 'categories'), where('status', '==', 'deleted'))),
      ]);
      setTrashCount(n.size + o.size + p.size + c.size);
    } catch {
      // ignore if user lacks access
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate('/admin/login', { replace: true });
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          if (user.email === 'emmanuelmuke58@gmail.com') {
            const profile: Omit<AdminUser, 'id'> = {
              email: user.email,
              role: 'super_admin',
              status: 'active',
              canDelete: true,
              assignedModules: [],
            };
            await setDoc(userDocRef, profile);
            setUserProfile({ id: user.uid, ...profile });
            setUserRole('super_admin');
          } else {
            await auth.signOut();
            navigate('/', { replace: true });
            return;
          }
        } else {
          const data = userDoc.data() as Omit<AdminUser, 'id'>;
          if (data.status === 'suspended') {
            await auth.signOut();
            navigate('/admin/login', { replace: true });
            return;
          }
          if (data.role === 'user') {
            navigate('/', { replace: true });
            return;
          }
          setUserProfile({ id: user.uid, ...data });
          setUserRole(data.role);
        }
        refreshTrashCount();
      } catch (e) {
        console.error('Admin auth verification error:', e);
        if (user.email === 'emmanuelmuke58@gmail.com') {
          setUserProfile({
            id: user.uid,
            email: user.email,
            role: 'super_admin',
            status: 'active',
            canDelete: true,
          });
          setUserRole('super_admin');
          refreshTrashCount();
        } else {
          navigate('/', { replace: true });
          return;
        }
      } finally {
        setAuthChecking(false);
      }
    });
    return unsubscribe;
  }, [navigate, refreshTrashCount]);

  React.useEffect(() => {
    if (!authChecking && userRole) {
      refreshTrashCount();
    }
  }, [location.pathname, authChecking, userRole, refreshTrashCount]);

  React.useEffect(() => {
    const onTrashUpdated = () => refreshTrashCount();
    window.addEventListener(TRASH_UPDATED_EVENT, onTrashUpdated);
    return () => window.removeEventListener(TRASH_UPDATED_EVENT, onTrashUpdated);
  }, [refreshTrashCount]);

  const handleLogout = async () => {
    await logActivity('auth', 'logout', 'Admin logged out');
    await auth.signOut();
    navigate('/');
  };

  const effectiveAvatar = userProfile?.avatarUrl || auth.currentUser?.photoURL || '';
  const effectiveName = userProfile?.displayName || auth.currentUser?.displayName || auth.currentUser?.email || 'Administrator';

  React.useEffect(() => {
    setAvatarImgError(false);
  }, [effectiveAvatar]);

  const openProfileModal = () => {
    setProfileNameDraft(userProfile?.displayName || auth.currentUser?.displayName || '');
    setProfileAvatarDraft(userProfile?.avatarUrl || auth.currentUser?.photoURL || '');
    setProfileError(null);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSavingProfile(true);
    setProfileError(null);
    const cleanName = profileNameDraft.trim();
    const cleanAvatar = profileAvatarDraft.trim();
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: cleanName,
        avatarUrl: cleanAvatar,
      });
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, {
            displayName: cleanName || null,
            photoURL: cleanAvatar || null,
          });
        } catch {
          // Ignore Firebase Auth profile sync errors if Firestore already succeeded
        }
      }
      setUserProfile((prev) =>
        prev ? { ...prev, displayName: cleanName, avatarUrl: cleanAvatar } : prev
      );
      setAvatarImgError(false);
      await logActivity('users', 'edit', 'Updated own admin profile & avatar', uid);
      setProfileModalOpen(false);
    } catch (err: any) {
      setProfileError(extractErrorMessage(err, 'Failed to save profile changes.'));
    } finally {
      setSavingProfile(false);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#083D91] border-t-transparent rounded-full"/>
      </div>
    );
  }

  const filteredSidebar = SIDEBAR_ITEMS.filter(item => {
    if (item.modKey && userRole === 'content_manager'&& userProfile?.assignedModules?.length) {
      return userProfile.assignedModules.includes(item.modKey);
    }
    if (!item.role) return true;
    if (userRole === 'super_admin') return true;
    if (item.role === 'admin'&& userRole === 'admin') return true;
    if (item.role === 'editor'&& ['admin', 'editor', 'content_manager'].includes(userRole || '')) return true;
    return false;
  });

  const renderSidebarLink = (item: (typeof SIDEBAR_ITEMS)[number], closeMobile?: boolean) => (
    <NavLink
      key={item.name}
      to={item.path}
      end={item.path === '/admin'}
      onClick={closeMobile ? () => setSidebarOpen(false) : undefined}
      className={({ isActive }) => cn(
        "flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
        isActive
          ? "bg-white/10 text-white border-l-4 border-teal-400": "text-white/70 hover:bg-white/5 hover:text-white")}
    >
      <span className="flex items-center gap-3 min-w-0">
        <item.icon size={20} className={cn("flex-shrink-0 transition-colors", location.pathname === item.path ? "text-teal-400": "group-hover:text-teal-400")} />
        <span className="truncate">{item.name}</span>
      </span>
      {item.isTrash && trashCount > 0 && (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white flex-shrink-0">
          {trashCount}
        </span>
      )}
    </NavLink>
  );

  return (
    <AdminAuthContext.Provider value={{ userProfile, userRole }}>
      <div className="min-h-screen bg-[#F1F5F9] flex overflow-x-clip">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-72 bg-[#083D91] text-white flex-col sticky top-0 h-screen shadow-2xl shrink-0">
          <div className="p-8 border-b border-white/10">
            <NavLink to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain"/>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold">RWANDA</span>
                <span className="text-xs font-bold text-teal-400">ADMIN</span>
              </div>
            </NavLink>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredSidebar.map((item) => renderSidebarLink(item, false))}
          </nav>
          <div className="p-4 border-t border-white/10 space-y-1">
            <NavLink to="/" className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all">
              <ExternalLink size={16} /> View Public Website
            </NavLink>
            <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/10 transition-all">
              <LogOut size={20} /> Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
            <div className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <button
                  type="button"
                  aria-label="Open admin menu"
                  className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={22} />
                </button>
                <div className="relative max-w-md w-full hidden md:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text" placeholder="Search dashboard..." onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) navigate(`/search?q=${encodeURIComponent(val)}`);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 transition-all"/>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-3 lg:gap-5 shrink-0">
                <button
                  type="button"
                  aria-label="Toggle search"
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-[#083D91] rounded-xl transition-colors"
                >
                  <Search size={19} />
                </button>
                <NavLink to="/admin/trash" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors relative" title="Trash / Deleted Items">
                  <Trash2 size={20} />
                  {trashCount > 0 && (
                    <span className="absolute top-1.5 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {trashCount}
                    </span>
                  )}
                </NavLink>
                <NavLink to="/admin/logs" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors relative" title="Activity Logs">
                  <Bell size={20} />
                </NavLink>
                <button
                  type="button"
                  onClick={openProfileModal}
                  title="Edit my profile & photo"
                  className="flex items-center gap-2.5 sm:gap-3 pl-2.5 sm:pl-5 border-l border-slate-200 hover:opacity-90 transition-opacity cursor-pointer text-left"
                >
                  <div className="flex flex-col text-right hidden sm:flex min-w-0">
                    <span className="text-sm font-bold text-slate-900 truncate max-w-[180px]">{effectiveName}</span>
                    <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{userRole?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="relative w-9 h-9 sm:w-10 sm:h-10 bg-[#083D91] rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold shrink-0 overflow-hidden group">
                    {effectiveAvatar && !avatarImgError ? (
                      <img
                        src={effectiveAvatar}
                        alt={effectiveName}
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarImgError(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{effectiveName[0].toUpperCase()}</span>
                    )}
                    <span className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Camera size={14} />
                    </span>
                  </div>
                </button>
              </div>
            </div>
            {mobileSearchOpen && (
              <div className="md:hidden border-t border-slate-100 px-4 py-2.5 bg-slate-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text" autoFocus
                    placeholder="Search content & press Enter..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          setMobileSearchOpen(false);
                          navigate(`/search?q=${encodeURIComponent(val)}`);
                        }
                      }
                    }}
                    className="w-full min-h-[40px] pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"/>
                </div>
              </div>
            )}
          </header>

          <main className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full min-w-0">
            <Outlet />
          </main>
        </div>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-72 max-w-[85vw] h-full bg-[#083D91] text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
              <div className="p-6 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain"/>
                  </div>
                  <span className="text-sm font-bold tracking-tight">RWANDA ADMIN</span>
                </div>
                <button
                  type="button"
                  aria-label="Close admin menu"
                  onClick={() => setSidebarOpen(false)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {filteredSidebar.map((item) => renderSidebarLink(item, true))}
              </nav>
              <div className="p-4 border-t border-white/10 space-y-1 pb-safe">
                <NavLink
                  to="/"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-xs font-medium text-white/80 hover:bg-white/5 hover:text-white transition-all"
                >
                  <ExternalLink size={16} /> View Public Website
                </NavLink>
                <button onClick={handleLogout} className="min-h-[44px] flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/10 transition-all">
                  <LogOut size={20} /> Logout
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* My Admin Profile & Photo Modal */}
        {profileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-[#102B4E]">My Admin Profile</h3>
                  <p className="text-xs text-slate-400">{userProfile?.email || auth.currentUser?.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveProfile} className="p-6 space-y-5 overflow-y-auto">
                <ImageUploadField
                  label="Profile Photo"
                  kind="avatar"
                  aspectHint="1:1"
                  cameraFacing="user"
                  registerMedia={false}
                  value={profileAvatarDraft}
                  onChange={(url) => setProfileAvatarDraft(url)}
                  helperText="Upload from device or front camera, then crop cleanly to a square."
                />

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Display Name (Shown on Articles)
                  </label>
                  <input
                    type="text"
                    value={profileNameDraft}
                    onChange={(e) => setProfileNameDraft(e.target.value)}
                    placeholder="e.g. Jean-Paul Habimana"
                    className="w-full min-h-[44px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                {profileError && (
                  <p className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {profileError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(false)}
                    className="min-h-[42px] px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="min-h-[42px] px-6 py-2 bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminAuthContext.Provider>
  );
}
