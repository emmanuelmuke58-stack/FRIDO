import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopBar, Navbar } from './Header';
import { Footer, MobileBottomNav } from './Footer';
import { trackPageView } from '../../lib/services';

export function Layout() {
  const location = useLocation();

  React.useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-clip">
      <TopBar />
      <Navbar />
      <main className="flex-grow pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
