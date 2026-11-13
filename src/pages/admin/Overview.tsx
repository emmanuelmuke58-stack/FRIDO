import React from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { NavLink } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Newspaper, Briefcase, GraduationCap, ClipboardList, Users, Mail,
  Eye, MousePointer2, FileEdit, Star, TrendingUp, TrendingDown
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { subDays, format, isAfter } from 'date-fns';

const COLORS = ['#083D91', '#14B8A6', '#6366F1', '#F59E0B', '#EF4444'];

interface StatCardProps {
  title: string;
  value: number;
  change: number | null;
  icon: any;
  color: string;
  to: string;
}

const StatCard = ({ title, value, change, icon: Icon, color, to }: StatCardProps) => (
  <NavLink
    to={to}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-teal-200 transition-all block group"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl transition-transform group-hover:scale-110", color)}>
        <Icon size={24} />
      </div>
      {change !== null && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
          change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
        )}>
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-3xl font-extrabold text-[#102B4E] mt-1">{value.toLocaleString()}</p>
  </NavLink>
);

function calculatePeriodChange(items: any[], dateField: string): number | null {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const fourteenDaysAgo = subDays(now, 14);

  let currentPeriod = 0;
  let previousPeriod = 0;

  items.forEach(item => {
    const raw = item[dateField];
    if (!raw) return;
    const d = new Date(raw);
    if (isAfter(d, sevenDaysAgo)) {
      currentPeriod++;
    } else if (isAfter(d, fourteenDaysAgo)) {
      previousPeriod++;
    }
  });

  if (previousPeriod === 0) return currentPeriod > 0 ? 100 : null;
  return Math.round(((currentPeriod - previousPeriod) / previousPeriod) * 100);
}

export function AdminOverview() {
  const [stats, setStats] = React.useState({
    publishedNews: 0,
    draftNews: 0,
    jobs: 0,
    scholarships: 0,
    tenders: 0,
    others: 0,
    users: 0,
    subscribers: 0,
    visitors: 0,
    clicks: 0
  });
  const [changes, setChanges] = React.useState<Record<string, number | null>>({});
  const [trafficData, setTrafficData] = React.useState<any[]>([]);
  const [categoryData, setCategoryData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const [newsSnap, oppsSnap, usersSnap, subsSnap, analyticsSnap] = await Promise.all([
          getDocs(collection(db, 'news')),
          getDocs(collection(db, 'opportunities')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'subscribers')),
          getDocs(query(collection(db, 'analytics'), orderBy('timestamp', 'desc'), limit(2000)))
        ]);

        const opps = oppsSnap.docs.map(d => d.data());
        const news = newsSnap.docs.map(d => d.data());
        const subs = subsSnap.docs.map(d => d.data());
        const analytics = analyticsSnap.docs.map(d => d.data());

        // Last 7 days traffic distribution (real counts per day)
        const chartDays: any[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = subDays(new Date(), i);
          const dateKey = format(d, 'yyyy-MM-dd');
          const dayViews = analytics.filter(a => a.timestamp && format(new Date(a.timestamp), 'yyyy-MM-dd') === dateKey).length;
          chartDays.push({ name: format(d, 'MMM dd'), views: dayViews });
        }

        const publishedNews = news.filter(n => n.status === 'published');
        const draftNews = news.filter(n => n.status === 'draft');
        const jobs = opps.filter(o => o.category === 'Jobs' && o.status === 'active');
        const scholarships = opps.filter(o => o.category === 'Scholarships' && o.status === 'active');
        const tenders = opps.filter(o => o.category === 'Tenders' && o.status === 'active');
        const others = opps.filter(o => o.category === 'Others' && o.status === 'active');

        setStats({
          publishedNews: publishedNews.length,
          draftNews: draftNews.length,
          jobs: jobs.length,
          scholarships: scholarships.length,
          tenders: tenders.length,
          others: others.length,
          users: usersSnap.size,
          subscribers: subs.length,
          visitors: new Set(analytics.map(a => a.visitorId).filter(Boolean)).size,
          clicks: opps.reduce((acc, curr) => acc + (curr.clicks || 0), 0)
        });

        setChanges({
          publishedNews: calculatePeriodChange(publishedNews, 'publishedAt'),
          draftNews: calculatePeriodChange(draftNews, 'publishedAt'),
          jobs: calculatePeriodChange(jobs, 'createdAt'),
          scholarships: calculatePeriodChange(scholarships, 'createdAt'),
          tenders: calculatePeriodChange(tenders, 'createdAt'),
          others: calculatePeriodChange(others, 'createdAt'),
          subscribers: calculatePeriodChange(subs, 'subscribedAt'),
          visitors: calculatePeriodChange(analytics, 'timestamp')
        });

        setTrafficData(chartDays);
        setCategoryData([
          { name: 'Jobs', value: jobs.length },
          { name: 'Scholarships', value: scholarships.length },
          { name: 'Tenders', value: tenders.length },
          { name: 'Others', value: others.length },
          { name: 'News', value: publishedNews.length }
        ]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">Overview</h1>
        <p className="text-slate-500 mt-2">Real-time overview of Rwanda Opportunities content, users, and traffic.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Published News" value={stats.publishedNews} change={changes.publishedNews ?? null} icon={Newspaper} color="bg-blue-50 text-blue-600" to="/admin/news" />
        <StatCard title="Draft News" value={stats.draftNews} change={changes.draftNews ?? null} icon={FileEdit} color="bg-amber-50 text-amber-600" to="/admin/news" />
        <StatCard title="Active Jobs" value={stats.jobs} change={changes.jobs ?? null} icon={Briefcase} color="bg-teal-50 text-teal-600" to="/admin/jobs" />
        <StatCard title="Scholarships" value={stats.scholarships} change={changes.scholarships ?? null} icon={GraduationCap} color="bg-indigo-50 text-indigo-600" to="/admin/scholarships" />
        <StatCard title="Active Tenders" value={stats.tenders} change={changes.tenders ?? null} icon={ClipboardList} color="bg-sky-50 text-sky-600" to="/admin/tenders" />
        <StatCard title="Other Opportunities" value={stats.others} change={changes.others ?? null} icon={Star} color="bg-emerald-50 text-emerald-600" to="/admin/opportunities" />
        <StatCard title="Registered Users" value={stats.users} change={null} icon={Users} color="bg-slate-100 text-slate-700" to="/admin/users" />
        <StatCard title="Subscribers" value={stats.subscribers} change={changes.subscribers ?? null} icon={Mail} color="bg-pink-50 text-pink-600" to="/admin/newsletter" />
        <StatCard title="Unique Visitors" value={stats.visitors} change={changes.visitors ?? null} icon={Eye} color="bg-purple-50 text-purple-600" to="/admin/reports" />
        <StatCard title="App Clicks" value={stats.clicks} change={null} icon={MousePointer2} color="bg-orange-50 text-orange-600" to="/admin/reports" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Traffic Chart */}
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg">Website Traffic (Last 7 Days)</h3>
            <NavLink to="/admin/reports" className="text-xs font-bold text-teal-600 hover:underline">View Report</NavLink>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="views" stroke="#14B8A6" strokeWidth={3} fillOpacity={1} fill="url(#colorViews)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg">Content Distribution</h3>
            <NavLink to="/admin/reports" className="text-xs font-bold text-teal-600 hover:underline">Full Analytics</NavLink>
          </div>
          <div className="h-[300px] flex items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 w-44">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs font-medium text-slate-600 truncate">{entry.name}</span>
                  <span className="text-xs font-bold text-slate-900 ml-auto">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
