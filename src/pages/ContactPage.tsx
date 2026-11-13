import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettings } from '../lib/SettingsContext';

export function ContactPage() {
  const { settings } = useSettings();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: ''});
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success'| 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatusMsg(null);
    try {
      await addDoc(collection(db, 'messages'), {
        ...formData,
        timestamp: new Date().toISOString(),
        status: 'unread'});
      setStatusMsg({ type: 'success', text: 'Message sent successfully! We will get back to you soon.'});
      setFormData({ name: '', email: '', subject: '', message: ''});
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to send message. Please try again.'});
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 sm:py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14">
          {/* Info Side */}
          <div className="space-y-8 sm:space-y-10 min-w-0">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#102B4E] mb-4 sm:mb-6">Let's Connect</h1>
              <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-md">
                Have questions about an opportunity or need assistance? Our team is here to help you navigate your journey.
              </p>
            </div>

            <div className="space-y-6 sm:space-y-8">
               <div className="flex gap-4 sm:gap-5 items-start min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <Mail size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Us</p>
                    <p className="text-base sm:text-lg font-bold text-[#102B4E] break-all">{settings.contactEmail}</p>
                  </div>
               </div>
               <div className="flex gap-4 sm:gap-5 items-start min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <Phone size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Call Us</p>
                    <p className="text-base sm:text-lg font-bold text-[#102B4E] break-words">{settings.contactPhone}</p>
                  </div>
               </div>
               <div className="flex gap-4 sm:gap-5 items-start min-w-0">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <MapPin size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Office</p>
                    <p className="text-base sm:text-lg font-bold text-[#102B4E] break-words">{settings.address}</p>
                  </div>
               </div>
            </div>

            <div className="bg-[#083D91] p-6 sm:p-8 rounded-2xl sm:rounded-3xl text-white space-y-3 sm:space-y-4 shadow-xl">
               <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                 <MessageSquare className="text-teal-400 shrink-0"/> Live Support
               </h3>
               <p className="text-white/80 text-sm leading-relaxed">
                 For urgent inquiries, please reach out during business hours (Mon-Fri, 8 AM - 5 PM).
               </p>
            </div>
          </div>

          {/* Form Side */}
          <div className="bg-white p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-[#102B4E] mb-6 sm:mb-8">Send us a Message</h2>
            {statusMsg && (
              <div className={`mb-6 p-4 rounded-2xl text-sm font-medium ${statusMsg.type === 'success'? 'bg-teal-50 text-teal-800 border border-teal-200': 'bg-red-50 text-red-700 border border-red-200'}`}>
                {statusMsg.text}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input required
                      className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" placeholder="John Doe" value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                    <input required
                      type="email" className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" placeholder="john@example.com" value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input required
                    className="w-full min-h-[44px] p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" placeholder="How can we help?" value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message</label>
                  <textarea required
                    rows={5}
                    className="w-full p-3.5 sm:p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all resize-none" placeholder="Your message here..." value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                  />
               </div>
               <button type="submit" disabled={sending}
                 className="min-h-[48px] w-full bg-[#083D91] hover:bg-[#07366D] text-white py-3.5 sm:py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50">
                 {sending ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"/> : <Send size={20} />}
                 Send Message
               </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
