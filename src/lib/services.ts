import {
  collection, addDoc, doc, updateDoc, deleteDoc, increment
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { extractErrorMessage } from './utils';
import { invalidatePublicCache } from './publicData';

export type ActivityModule =
  | 'news'| 'jobs'| 'scholarships'| 'tenders'| 'opportunities'| 'pages'| 'categories'| 'media'| 'users'| 'newsletter'| 'reports'| 'trash'| 'settings'| 'auth';

export type ActivityAction =
  | 'create'| 'edit'| 'delete'| 'restore'| 'permanent_delete'| 'bulk_delete'| 'empty_trash'| 'purge'| 'publish'| 'login'| 'logout'| 'export';

export interface ActivityAuditMeta {
  recordType?: string;
  recordTitle?: string;
  deletionType?: 'soft_delete'| 'permanent_delete'| 'restore'| 'bulk_delete'| 'empty_trash'| 'purge';
  reason?: string;
}

export const TRASH_UPDATED_EVENT = 'rwanda-trash-updated';

export function notifyTrashUpdated() {
  invalidatePublicCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TRASH_UPDATED_EVENT));
  }
}

export async function logActivity(
  module: ActivityModule,
  action: ActivityAction,
  details: string,
  targetId?: string | null,
  meta?: ActivityAuditMeta
) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const payload: Record<string, any> = {
      adminId: user.uid,
      adminName: (user.displayName || user.email || 'Admin').slice(0, 150),
      action: action.slice(0, 50),
      module: module.slice(0, 50),
      targetId: targetId ? targetId.slice(0, 128) : null,
      details: details.slice(0, 1000),
      timestamp: new Date().toISOString(),
    };
    if (meta?.recordType) payload.recordType = meta.recordType.slice(0, 50);
    if (meta?.recordTitle) payload.recordTitle = meta.recordTitle.slice(0, 200);
    if (meta?.deletionType) payload.deletionType = meta.deletionType;
    if (meta?.reason) payload.reason = meta.reason.slice(0, 500);

    await addDoc(collection(db, 'activityLogs'), payload);
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

export async function softDeleteRecord(
  collectionName: 'news'| 'opportunities'| 'pages'| 'categories',
  id: string,
  previousStatus: string,
  title: string,
  logModule: ActivityModule,
  reason?: string
) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in as an administrator to delete records.');
  }

  const cleanReason = reason?.trim().slice(0, 500) || null;
  const path = `${collectionName}/${id}`;

  try {
    await updateDoc(doc(db, collectionName, id), {
      status: 'deleted',
      previousStatus: (previousStatus || 'draft').slice(0, 30),
      deletedAt: new Date().toISOString(),
      deletedBy: user.uid.slice(0, 128),
      deletedByName: (user.displayName || user.email || 'Admin').slice(0, 150),
      deleteReason: cleanReason,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  notifyTrashUpdated();

  await logActivity(logModule, 'delete', `Moved ${logModule} to Trash: ${title}`, id, {
    recordType: logModule,
    recordTitle: title,
    deletionType: 'soft_delete',
    reason: cleanReason || undefined,
  });
}

export async function restoreRecord(
  collectionName: 'news'| 'opportunities'| 'pages'| 'categories',
  id: string,
  fallbackStatus: string,
  previousStatus: string | undefined,
  title: string,
  logModule: ActivityModule
) {
  const restoredStatus =
    previousStatus && previousStatus !== 'deleted'? previousStatus : fallbackStatus;
  const path = `${collectionName}/${id}`;

  try {
    await updateDoc(doc(db, collectionName, id), {
      status: restoredStatus,
      deletedAt: null,
      deletedBy: null,
      deletedByName: null,
      previousStatus: null,
      deleteReason: null,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  notifyTrashUpdated();

  await logActivity(logModule, 'restore', `Restored ${logModule} from Trash: ${title}`, id, {
    recordType: logModule,
    recordTitle: title,
    deletionType: 'restore',
  });
}

export async function permanentDeleteRecord(
  collectionName: string,
  id: string,
  title: string,
  logModule: ActivityModule,
  reason?: string
) {
  const path = `${collectionName}/${id}`;
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }

  notifyTrashUpdated();

  await logActivity(logModule, 'permanent_delete', `Permanently deleted ${logModule}: ${title}`, id, {
    recordType: logModule,
    recordTitle: title,
    deletionType: 'permanent_delete',
    reason: reason?.trim().slice(0, 500) || undefined,
  });
}

export interface BulkOperationResult {
  succeeded: number;
  failed: number;
  errors: string[];
}

export async function bulkSoftDeleteRecords(
  collectionName: 'news'| 'opportunities'| 'pages'| 'categories',
  items: Array<{ id: string; status: string; title: string }>,
  logModule: ActivityModule,
  reason?: string
): Promise<BulkOperationResult> {
  const user = auth.currentUser;
  if (!user) {
    return {
      succeeded: 0,
      failed: items.length,
      errors: ['You must be signed in as an administrator to delete records.'],
    };
  }

  const now = new Date().toISOString();
  const cleanReason = reason?.trim().slice(0, 500) || null;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const path = `${collectionName}/${item.id}`;
    try {
      await updateDoc(doc(db, collectionName, item.id), {
        status: 'deleted',
        previousStatus: (item.status || 'draft').slice(0, 30),
        deletedAt: now,
        deletedBy: user.uid.slice(0, 128),
        deletedByName: (user.displayName || user.email || 'Admin').slice(0, 150),
        deleteReason: cleanReason,
      });
      succeeded++;
    } catch (err: any) {
      failed++;
      try {
        handleFirestoreError(err, OperationType.UPDATE, path);
      } catch (wrappedErr) {
        errors.push(`${item.title}: ${extractErrorMessage(wrappedErr, 'Permission denied')}`);
      }
    }
  }

  if (succeeded > 0) {
    notifyTrashUpdated();
    await logActivity(
      logModule,
      'bulk_delete',
      `Moved ${succeeded} ${logModule} record(s) to Trash (${failed} failed)`,
      null,
      {
        recordType: logModule,
        recordTitle: `${succeeded} ${logModule} items`,
        deletionType: 'bulk_delete',
        reason: cleanReason || undefined,
      }
    );
  }

  return { succeeded, failed, errors };
}

export async function bulkPermanentDeleteRecords(
  collectionName: string,
  items: Array<{ id: string; title: string }>,
  logModule: ActivityModule,
  reason?: string
): Promise<BulkOperationResult> {
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of items) {
    const path = `${collectionName}/${item.id}`;
    try {
      await deleteDoc(doc(db, collectionName, item.id));
      succeeded++;
    } catch (err: any) {
      failed++;
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrappedErr) {
        errors.push(`${item.title}: ${extractErrorMessage(wrappedErr, 'Permission denied')}`);
      }
    }
  }

  if (succeeded > 0) {
    notifyTrashUpdated();
    await logActivity(
      logModule,
      'bulk_delete',
      `Permanently deleted ${succeeded} ${logModule} record(s) (${failed} failed)`,
      null,
      {
        recordType: logModule,
        recordTitle: `${succeeded} ${logModule} items`,
        deletionType: 'permanent_delete',
        reason: reason?.trim().slice(0, 500) || undefined,
      }
    );
  }

  return { succeeded, failed, errors };
}

export async function trackPageView(path: string) {
  const visitorId = localStorage.getItem('visitor_id') || Math.random().toString(36).substring(7);
  localStorage.setItem('visitor_id', visitorId);

  try {
    await addDoc(collection(db, 'analytics'), {
      type: 'page_view',
      path: path.slice(0, 500),
      visitorId: visitorId.slice(0, 100),
      device: window.innerWidth < 768 ? 'mobile': window.innerWidth < 1024 ? 'tablet': 'desktop',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Analytics error:', e);
  }
}

export async function incrementCounter(collectionName: string, id: string, field: 'views'| 'clicks') {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      [field]: increment(1),
    });
  } catch (e) {
    console.error(`Failed to increment ${field}:`, e);
  }
}
