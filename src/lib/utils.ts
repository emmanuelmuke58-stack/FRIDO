import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `post-${Date.now()}`;
}

export function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object'&& value !== null) {
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const d = maybeTs.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof maybeTs.seconds === 'number') {
      const d = new Date(maybeTs.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof value === 'string'|| typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function safeFormatDate(value: unknown, pattern: string, fallback = '—'): string {
  const d = safeDate(value);
  if (!d) return fallback;
  try {
    return format(d, pattern);
  } catch {
    return fallback;
  }
}

export function formatRelativeTime(
  value: unknown,
  nowMs: number = Date.now(),
  language: 'English' | 'Kinyarwanda' = 'English'
): string {
  const d = safeDate(value);
  if (!d) return '—';

  const diffSeconds = Math.max(0, Math.floor((nowMs - d.getTime()) / 1000));
  const isRw = language === 'Kinyarwanda';

  if (diffSeconds < 60) {
    return isRw ? 'Ubu nyine' : 'Just now';
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    if (isRw) return diffMinutes === 1 ? 'Hashize umunota 1' : `Hashize iminota ${diffMinutes}`;
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    if (isRw) return diffHours === 1 ? 'Hashize isaha 1' : `Hashize amasaha ${diffHours}`;
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    if (isRw) return diffDays === 1 ? 'Hashize umunsi 1' : `Hashize iminsi ${diffDays}`;
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    if (isRw) return diffMonths === 1 ? 'Hashize ukwezi 1' : `Hashize amezi ${diffMonths}`;
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  if (isRw) return diffYears === 1 ? 'Hashize umwaka 1' : `Hashize imyaka ${diffYears}`;
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

export function extractErrorMessage(err: unknown, fallback = 'Operation failed. Please try again.'): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string'? err : '';
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      return parsed.path ? `${parsed.error} (${parsed.path})` : parsed.error;
    }
  } catch {
    // not JSON
  }
  return raw;
}

export function stripUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = v;
    }
  }
  return result;
}
