import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { AdminPage } from './pages/AdminPage';
import { NewsListingPage } from './pages/NewsPage';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { OpportunitiesListingPage } from './pages/OpportunitiesPage';
import { OpportunityDetailPage } from './pages/OpportunityDetailPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminOverview } from './pages/admin/Overview';
import { NewsManagement } from './pages/admin/NewsManagement';
import { OpportunityManagement } from './pages/admin/OpportunityManagement';
import { ReportsPage } from './pages/admin/Reports';
import { ActivityLogs } from './pages/admin/ActivityLogs';
import { PageManagement } from './pages/admin/PageManagement';
import { UserManagement } from './pages/admin/UserManagement';
import { NewsletterManagement } from './pages/admin/NewsletterManagement';
import { MediaManagement } from './pages/admin/MediaManagement';
import { SettingsManagement } from './pages/admin/Settings';
import { HomepageManagement } from './pages/admin/HomepageManagement';
import { CategoryManagement } from './pages/admin/CategoryManagement';
import { TrashManagement } from './pages/admin/TrashManagement';
import { SearchPage } from './pages/SearchPage';
import { StaticPage } from './pages/StaticPage';
import { ContactPage } from './pages/ContactPage';
import { AiHubPage } from './pages/AiHubPage';
import { OfflineIndicator } from './components/ui/OfflineIndicator';

const routerBasename =
  typeof window !== 'undefined'&&
  (window.location.pathname === '/FRIDO'|| window.location.pathname.startsWith('/FRIDO/'))
    ? '/FRIDO': '/';

export default function App() {
  return (
    <Router basename={routerBasename}>
      <OfflineIndicator />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="news" element={<NewsListingPage />} />
          <Route path="news/category/:category" element={<NewsListingPage />} />
          <Route path="news/:slug" element={<NewsDetailPage />} />

          <Route path="jobs" element={<OpportunitiesListingPage />} />
          <Route path="jobs/category/:subCategory" element={<OpportunitiesListingPage />} />
          <Route path="jobs/:slug" element={<OpportunityDetailPage />} />

          <Route path="scholarships" element={<OpportunitiesListingPage />} />
          <Route path="scholarships/category/:subCategory" element={<OpportunitiesListingPage />} />
          <Route path="scholarships/:slug" element={<OpportunityDetailPage />} />

          <Route path="tenders" element={<OpportunitiesListingPage />} />
          <Route path="tenders/category/:subCategory" element={<OpportunitiesListingPage />} />
          <Route path="tenders/:slug" element={<OpportunityDetailPage />} />

          <Route path="opportunities" element={<OpportunitiesListingPage />} />
          <Route path="opportunities/category/:subCategory" element={<OpportunitiesListingPage />} />
          <Route path="opportunities/:slug" element={<OpportunityDetailPage />} />

          <Route path="search" element={<SearchPage />} />

          <Route path="p/:slug" element={<StaticPage />} />
          <Route path="about" element={<StaticPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="ai" element={<AiHubPage />} />
          <Route path="privacy" element={<StaticPage />} />
          <Route path="terms" element={<StaticPage />} />
        </Route>

        {/* Admin Dashboard Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="news" element={<NewsManagement />} />
          <Route path="jobs" element={<OpportunityManagement />} />
          <Route path="scholarships" element={<OpportunityManagement />} />
          <Route path="tenders" element={<OpportunityManagement />} />
          <Route path="opportunities" element={<OpportunityManagement />} />
          <Route path="categories" element={<CategoryManagement />} />
          <Route path="pages" element={<PageManagement />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="newsletter" element={<NewsletterManagement />} />
          <Route path="media" element={<MediaManagement />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="trash" element={<TrashManagement />} />
          <Route path="logs" element={<ActivityLogs />} />
          <Route path="homepage" element={<HomepageManagement />} />
          <Route path="settings" element={<SettingsManagement />} />
          <Route path="*" element={<AdminOverview />} />
        </Route>

        {/* Auth Fallback */}
        <Route path="/admin/login" element={<AdminPage />} />

        <Route path="*" element={<Navigate to="/"replace />} />
      </Routes>
    </Router>
  );
}
