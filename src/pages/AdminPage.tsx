import React from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { auth } from '@/src/lib/firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { ShieldCheck, ArrowLeft, LogIn } from 'lucide-react';
import { useSettings } from '@/src/lib/SettingsContext';
import { logActivity } from '@/src/lib/services';

export function AdminPage() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [loading, setLoading] = React.useState(true);
  const [signingIn, setSigningIn] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) {
        navigate('/admin', { replace: true });
      } else {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogin = async () => {
    setSigningIn(true);
    setError('');
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      await logActivity('auth', 'login', 'Admin signed in via Google');
      navigate('/admin', { replace: true });
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Sign-in failed. Please try again.');
      setSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-inter">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 p-8 md:p-10 text-center space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-[#083D91] rounded-full flex items-center justify-center p-2 shadow-lg">
            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#102B4E] font-montserrat">Admin Portal</h1>
            <p className="text-sm text-slate-500 mt-1">{settings.websiteName} Management System</p>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left flex items-start gap-3">
          <ShieldCheck className="text-teal-600 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-xs text-slate-600 leading-relaxed">
            Sign in with your authorized Google administrator account (<span className="font-bold text-[#102B4E]">emmanuelmuke58@gmail.com</span> or assigned staff) to access content, user, and analytics controls.
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-medium rounded-xl">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={signingIn}
          className="w-full bg-[#083D91] hover:bg-[#07366D] text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {signingIn ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <LogIn size={20} />
          )}
          Sign in with Google
        </button>

        <NavLink to="/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#083D91] transition-colors">
          <ArrowLeft size={14} /> Return to Public Website
        </NavLink>
      </div>
    </div>
  );
}
