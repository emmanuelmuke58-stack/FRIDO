import React from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Newspaper, Briefcase, GraduationCap, ClipboardList, Users, Mail, 
  ArrowUpRight, ArrowDownRight, Eye, MousePointer2 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { subDays, format, isAfter } from 'date-fns';

const COLORS = ['#083D91', '#14B8A6', '#6366F1', '#F59E0B', '#EF4444'];

interface StatCardProps {
  title: string;
  value: number;
  change: number;
  icon: any;
  color: string;
}

const StatCard = ({ title, value, change, icon: Icon, color }: StatCardProps) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-xl", color)}>
        <Icon size={24} />
      </div>
      <div className={cn(
        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
        change >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      )}>
        {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {Math.abs(change)}%
      </div>
    </div>
    <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
    <p className="text-3xl font-extrabold text-[#102B4E] mt-1">{value.toLocaleString()}</p>
  </div>
);

import { TrendingUp, TrendingDown } from 'lucide-react';

export function AdminOverview() {
  const [stats, setStats] = React.useState({
    news: 0,
    jobs: 0,
    scholarships: 0,
    tenders: 0,
    users: 0,
    subscribers: 0,
    visitors: 0,
    clicks: 0
  });
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
          getDocs(query(collection(db, 'analytics'), orderBy('timestamp', 'desc'), limit(1000)))
        ]);

        const opps = oppsSnap.docs.map(d => d.data());
        const news = newsSnap.docs.map(d => d.data());
        const analytics = analyticsSnap.docs.map(d => d.data());

        const trafficMap: Record<string, number> = {};
        analytics.forEach(event => {
          const date = format(new Date(event.timestamp), 'MMM dd');
          trafficMap[date] = (trafficMap[date] || 0) + 1;
        });

        const formattedTraffic = Object.entries(trafficMap).map(([name, views]) => ({ name, views })).reverse().slice(-7);

        setStats({
          news: news.length,
          jobs: opps.filter(o => o.category === 'Jobs').length,
          scholarships: opps.filter(o => o.category === 'Scholarships').length,
          tenders: opps.filter(o => o.category === 'Tenders').length,
          users: usersSnap.size,
          subscribers: subsSnap.size,
          visitors: new Set(analytics.map(a => a.visitorId)).size,
          clicks: opps.reduce((acc, curr) => acc + (curr.clicks || 0), 0)
        });

        setTrafficData(formattedTraffic);
        setCategoryData([
          { name: 'Jobs', value: opps.filter(o => o.category === 'Jobs').length },
          { name: 'Scholarships', value: opps.filter(o => o.category === 'Scholarships').length },
          { name: 'Tenders', value: opps.filter(o => o.category === 'Tenders').length },
          { name: 'News', value: news.length }
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
        <p className="text-slate-500 mt-2">Welcome back! Here's what's happening with Rwanda Opportunities today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Published News" value={stats.news} change={12} icon={Newspaper} color="bg-blue-50 text-blue-600" />
        <StatCard title="Active Jobs" value={stats.jobs} change={8} icon={Briefcase} color="bg-teal-50 text-teal-600" />
        <StatCard title="Scholarships" value={stats.scholarships} change={-2} icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
        <StatCard title="Tenders" value={stats.tenders} change={15} icon={ClipboardList} color="bg-amber-50 text-amber-600" />
        <StatCard title="Total Users" value={stats.users} change={24} icon={Users} color="bg-slate-100 text-slate-700" />
        <StatCard title="Subscribers" value={stats.subscribers} change={5} icon={Mail} color="bg-pink-50 text-pink-600" />
        <StatCard title="Unique Visitors" value={stats.visitors} change={18} icon={Eye} color="bg-purple-50 text-purple-600" />
        <StatCard title="App Clicks" value={stats.clicks} change={10} icon={MousePointer2} color="bg-orange-50 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Traffic Chart */}
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-lg">Website Traffic (Last 7 Days)</h3>
            <button className="text-xs font-bold text-teal-600 hover:underline">View Report</button>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94A3B8', fontSize: 12}} />
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
            <button className="text-xs font-bold text-teal-600 hover:underline">Full Analytics</button>
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
            <div className="space-y-3 w-40">
              {categoryData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                  <span className="text-xs font-medium text-slate-600">{entry.name}</span>
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
