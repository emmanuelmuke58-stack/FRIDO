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
