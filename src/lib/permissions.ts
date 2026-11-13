import { AdminUser } from '../types';

export const PROTECTED_PAGE_SLUGS = ['home', 'login', 'about', 'privacy', 'terms', 'contact', 'admin'];

export function isProtectedSystemPage(slug?: string, isSystem?: boolean): boolean {
  if (isSystem) return true;
  if (!slug) return false;
  return PROTECTED_PAGE_SLUGS.includes(slug.toLowerCase());
}

export function canSoftDeleteContent(
  user: AdminUser | null,
  moduleName: 'News'| 'Jobs'| 'Scholarships'| 'Tenders'| 'Others'| 'Pages'| 'Categories',
  authorId?: string
): boolean {
  if (!user || user.status !== 'active') return false;
  if (user.role === 'super_admin'|| user.role === 'admin') return true;
  if (moduleName === 'Pages'|| moduleName === 'Categories') return false;

  if (user.role === 'content_manager') {
    if (user.canDelete === false) return false;
    if (user.assignedModules && user.assignedModules.length > 0) {
      return user.assignedModules.includes(moduleName);
    }
    return true;
  }

  if (user.role === 'editor') {
    return user.canDelete === true && Boolean(authorId && authorId === user.id);
  }

  return false;
}

export function canPermanentDelete(user: AdminUser | null): boolean {
  return Boolean(user && user.status === 'active'&& user.role === 'super_admin');
}

export function canRestoreContent(user: AdminUser | null): boolean {
  return Boolean(user && user.status === 'active'&& (user.role === 'super_admin'|| user.role === 'admin'));
}

export function canDeleteOperationalRecord(user: AdminUser | null): boolean {
  return Boolean(user && user.status === 'active'&& (user.role === 'super_admin'|| user.role === 'admin'));
}

export function canManageUsersOrSettings(user: AdminUser | null): boolean {
  return Boolean(user && user.status === 'active'&& user.role === 'super_admin');
}
