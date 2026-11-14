import React from 'react';
import { auth, db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Bot, BriefcaseBusiness, FileUser, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';

type Task = 'career' | 'job_match' | 'cv_review' | 'job_description' | 'admin_assistant';

const tools: { id: Task; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'career', label: 'Career Assistant', description: 'Get career and job-search guidance.', icon: MessageCircle },
  { id: 'job_match', label: 'Smart Job Matching', description: 'Compare your profile with active FRIDO jobs.', icon: BriefcaseBusiness },
  { id: 'cv_review', label: 'CV Assistant', description: 'Get clear, honest feedback on your CV.', icon: FileUser },
  { id: 'job_description', label: 'Job Description Generator', description: 'Draft a vacancy from employer-provided facts.', icon: Sparkles },
  { id: 'admin_assistant', label: 'Admin AI Assistant', description: 'Get help with FRIDO content operations.', icon: ShieldCheck },
];

export function AiHubPage() {
  const [task, setTask] = React.useState<Task>('career');
  const [input, setInput] = React.useState('');
  const [result, setResult] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const runAssistant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const payload: Record<string, unknown> = { text: input.trim() };
      if (task === 'job_match') {
        const snapshot = await getDocs(query(collection(db, 'opportunities'), where('status', '==', 'active')));
        payload.jobs = snapshot.docs
          .map((item) => {
            const data = item.data();
            return { title: data.title, organization: data.organization, category: data.category, location: data.location, summary: data.summary, requirements: data.requirements, qualifications: data.qualifications, experienceRequired: data.experienceRequired, deadline: data.deadline };
          })
          .filter((job) => job.category === 'Jobs')
          .slice(0, 60);
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (task !== 'career') {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in before using this feature.');
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ task, input: payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The AI request failed.');
      setResult(data.result || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeTool = tools.find((item) => item.id === task)!;
  return (
    <div className="min-h-[70vh] bg-slate-50 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-[#083D91] px-3 py-1.5 text-xs font-bold"><Bot size={15}/> FRIDO AI TOOLS</div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-[#102B4E]">Move your career forward with AI</h1>
          <p className="mt-3 text-slate-600">Practical support for job seekers, employers and FRIDO administrators. Always verify important details before acting on AI suggestions.</p>
        </div>
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-6 items-start">
          <nav className="bg-white rounded-2xl border border-slate-200 p-2 grid sm:grid-cols-2 lg:grid-cols-1 gap-1">
            {tools.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => { setTask(item.id); setResult(''); setError(''); }} className={`w-full text-left flex items-start gap-3 p-3 rounded-xl transition-colors ${task === item.id ? 'bg-blue-50 text-[#083D91]' : 'hover:bg-slate-50 text-slate-700'}`}>
                <Icon size={19} className="mt-0.5 shrink-0"/>
                <span><span className="block text-sm font-bold">{item.label}</span><span className="block text-xs text-slate-500 mt-1">{item.description}</span></span>
              </button>;
            })}
          </nav>
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#083D91] flex items-center justify-center"><activeTool.icon size={22}/></div>
              <div><h2 className="font-bold text-lg text-[#102B4E]">{activeTool.label}</h2><p className="text-xs text-slate-500">{activeTool.description}</p></div>
            </div>
            <form onSubmit={runAssistant} className="space-y-4">
              <label htmlFor="ai-input" className="block text-sm font-semibold text-slate-700">
                {task === 'career' ? 'What career question can I help with?' : task === 'job_match' ? 'Paste your skills, experience, education and preferred role.' : task === 'cv_review' ? 'Paste your CV text (remove phone numbers, addresses and other sensitive details first).' : task === 'job_description' ? 'Provide the role, employer details, duties, qualifications, location and deadline.' : 'Describe the FRIDO admin task or paste non-sensitive information for analysis.'}
              </label>
              <textarea id="ai-input" value={input} onChange={(event) => setInput(event.target.value)} rows={9} maxLength={20000} placeholder="Write or paste your information here..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-blue-100 resize-y" required/>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">Do not submit passwords, national ID numbers, or confidential personal information.</p>
                <button disabled={loading || !input.trim()} className="min-h-11 px-5 rounded-xl bg-[#083D91] hover:bg-[#062f70] text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">{loading ? 'Working...' : 'Generate response'} <Sparkles size={16}/></button>
              </div>
            </form>
            {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
            {result && <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"><h3 className="font-bold text-[#102B4E] mb-3">FRIDO AI response</h3><div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{result}</div><p className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500">AI can make mistakes. Check facts, requirements and deadlines against original sources.</p></div>}
          </section>
        </div>
      </div>
    </div>
  );
}
