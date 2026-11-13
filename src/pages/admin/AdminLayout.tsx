import React from 'react';
import {
  BarChart3, Newspaper, Briefcase, GraduationCap, ClipboardList,
  Users, Mail, Settings, History, PieChart, FileText, ExternalLink,
  Search, Bell, LogOut, Menu, X, Image as ImageIcon
} from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';
import { useSettings } from '../../lib/SettingsContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const SIDEBAR_ITEMS = [
  { name: 'Overview', path: '/admin', icon: BarChart3 },
  { name: 'News', path: '/admin/news', icon: Newspaper },
  { name: 'Jobs', path: '/admin/jobs', icon: Briefcase },
  { name: 'Scholarships', path: '/admin/scholarships', icon: GraduationCap },
  { name: 'Tenders', path: '/admin/tenders', icon: ClipboardList },
  { name: 'Other Opportunities', path: '/admin/opportunities', icon: ExternalLink },
  { name: 'Pages', path: '/admin/pages', icon: FileText, role: 'super_admin' },
  { name: 'Media Library', path: '/admin/media', icon: ImageIcon, role: 'editor' },
  { name: 'Users', path: '/admin/users', icon: Users, role: 'admin' },
  { name: 'Newsletter', path: '/admin/newsletter', icon: Mail, role: 'admin' },
  { name: 'Reports & Analytics', path: '/admin/reports', icon: PieChart, role: 'admin' },
  { name: 'Activity Logs', path: '/admin/logs', icon: History, role: 'admin' },
  { name: 'Settings', path: '/admin/settings', icon: Settings, role: 'super_admin' },
];

export function AdminLayout() {
  const { settings } = useSettings();
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [authChecking, setAuthChecking] = React.useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
            const profile = { email: user.email, role: 'super_admin', status: 'active' };
            await setDoc(userDocRef, profile);
            setUserRole('super_admin');
          } else {
            alert('Your account is not authorized to access the Admin Portal.');
            await auth.signOut();
            navigate('/', { replace: true });
            return;
          }
        } else {
          const data = userDoc.data();
          if (data.status === 'suspended') {
            await auth.signOut();
            navigate('/admin/login', { replace: true });
            alert('Your account has been suspended.');
            return;
          }
          if (data.role === 'user') {
            navigate('/', { replace: true });
            return;
          }
          setUserRole(data.role);
        }
      } catch (e) {
        console.error('Admin auth verification error:', e);
        if (user.email === 'emmanuelmuke58@gmail.com') {
          setUserRole('super_admin');
        } else {
          navigate('/', { replace: true });
          return;
        }
      } finally {
        setAuthChecking(false);
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogout = async () => {
    await logActivity('auth', 'logout', 'Admin logged out');
    await auth.signOut();
    navigate('/');
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-[#083D91] border-t-transparent rounded-full" />
      </div>
    );
  }

  const filteredSidebar = SIDEBAR_ITEMS.filter(item => {
    if (!item.role) return true;
    if (userRole === 'super_admin') return true;
    if (item.role === 'admin' && userRole === 'admin') return true;
    if (item.role === 'editor' && ['admin', 'editor', 'content_manager'].includes(userRole || '')) return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex font-inter">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-72 bg-[#083D91] text-white flex-col sticky top-0 h-screen shadow-2xl">
        <div className="p-8 border-b border-white/10">
          <NavLink to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold font-montserrat">RWANDA</span>
              <span className="text-xs font-bold font-montserrat text-teal-400">ADMIN</span>
            </div>
          </NavLink>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredSidebar.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-white/10 text-white border-l-4 border-teal-400"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon size={20} className={cn("transition-colors", location.pathname === item.path ? "text-teal-400" : "group-hover:text-teal-400")} />
              {item.name}
            </NavLink>
          ))}
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
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4 flex-1">
            <button className="lg:hidden p-2 text-slate-600" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="relative max-w-md w-full hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search dashboard..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) navigate(`/search?q=${encodeURIComponent(val)}`);
                  }
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-500 transition-all"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <NavLink to="/admin/logs" className="p-2 text-slate-400 hover:text-teal-600 transition-colors relative" title="Activity Logs">
              <Bell size={20} />
            </NavLink>
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="text-sm font-bold text-slate-900">{auth.currentUser?.displayName || auth.currentUser?.email || 'Administrator'}</span>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">{userRole?.replace('_', ' ')}</span>
              </div>
              <div className="w-10 h-10 bg-[#083D91] rounded-full border-2 border-white shadow-sm flex items-center justify-center text-white font-bold">
                {(auth.currentUser?.displayName || auth.currentUser?.email || 'A')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <main className="p-6 md:p-8 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-[#083D91] text-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-8 flex justify-between items-center border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-sm font-bold font-montserrat tracking-tight">RWANDA ADMIN</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {filteredSidebar.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  end={item.path === '/admin'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                    isActive ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={20} />
                  {item.name}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-red-300 hover:bg-red-500/10 transition-all">
                <LogOut size={20} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
