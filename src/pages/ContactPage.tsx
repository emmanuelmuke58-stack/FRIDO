import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettings } from '../lib/SettingsContext';

export function ContactPage() {
  const { settings } = useSettings();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        ...formData,
        timestamp: new Date().toISOString(),
        status: 'unread'
      });
      alert('Message sent successfully! We will get back to you soon.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Info Side */}
          <div className="space-y-12">
            <div>
              <h1 className="text-4xl md:text-6xl font-extrabold text-[#102B4E] font-montserrat mb-6">Let's Connect</h1>
              <p className="text-lg text-slate-500 leading-relaxed max-w-md">
                Have questions about an opportunity or need assistance? Our team is here to help you navigate your journey.
              </p>
            </div>

            <div className="space-y-8">
               <div className="flex gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <Mail size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email Us</p>
                    <p className="text-lg font-bold text-[#102B4E]">{settings.contactEmail}</p>
                  </div>
               </div>
               <div className="flex gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <Phone size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Call Us</p>
                    <p className="text-lg font-bold text-[#102B4E]">{settings.contactPhone}</p>
                  </div>
               </div>
               <div className="flex gap-6">
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-[#083D91] flex-shrink-0">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Office</p>
                    <p className="text-lg font-bold text-[#102B4E]">{settings.address}</p>
                  </div>
               </div>
            </div>

            <div className="bg-[#083D91] p-8 rounded-3xl text-white space-y-4 shadow-xl">
               <h3 className="text-xl font-bold flex items-center gap-2">
                 <MessageSquare className="text-teal-400" /> Live Support
               </h3>
               <p className="text-white/80 text-sm leading-relaxed">
                 For urgent inquiries, please reach out during business hours (Mon-Fri, 8 AM - 5 PM).
               </p>
            </div>
          </div>

          {/* Form Side */}
          <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-blue-900/5 border border-slate-100">
            <h2 className="text-2xl font-bold text-[#102B4E] mb-8">Send us a Message</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                    <input 
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" 
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                    <input 
                      required
                      type="email"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" 
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                  <input 
                    required
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all" 
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={e => setFormData({...formData, subject: e.target.value})}
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message</label>
                  <textarea 
                    required
                    rows={5}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-teal-500 transition-all resize-none" 
                    placeholder="Your message here..."
                    value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                  />
               </div>
               <button 
                 type="submit"
                 disabled={sending}
                 className="w-full bg-[#083D91] hover:bg-[#07366D] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50"
               >
                 {sending ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Send size={20} />}
                 Send Message
               </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
