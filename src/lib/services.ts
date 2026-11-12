import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from './firebase';

export type ActivityModule = 'news' | 'jobs' | 'scholarships' | 'tenders' | 'users' | 'settings' | 'auth';
export type ActivityAction = 'create' | 'edit' | 'delete' | 'publish' | 'login' | 'logout' | 'export';

export async function logActivity(module: ActivityModule, action: ActivityAction, details: string, targetId?: string) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, 'activityLogs'), {
      adminId: user.uid,
      adminName: user.displayName || user.email,
      action,
      module,
      targetId: targetId || null,
      details,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

export async function trackPageView(path: string) {
  const visitorId = localStorage.getItem('visitor_id') || Math.random().toString(36).substring(7);
  localStorage.setItem('visitor_id', visitorId);

  try {
    await addDoc(collection(db, 'analytics'), {
      type: 'page_view',
      path,
      visitorId,
      device: window.innerWidth < 768 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('Analytics error:', e);
  }
}

export async function incrementCounter(collectionName: string, id: string, field: 'views' | 'clicks') {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      [field]: increment(1)
    });
  } catch (e) {
    console.error(`Failed to increment ${field}:`, e);
  }
}
