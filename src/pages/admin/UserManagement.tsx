import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { AdminUser } from '../../types';
import { ShieldAlert, Trash2, Mail, CheckCircle2, Lock, Edit, X } from 'lucide-react';
import { logActivity, permanentDeleteRecord, bulkPermanentDeleteRecords } from '../../lib/services';
import { cn, extractErrorMessage } from '../../lib/utils';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { BulkActionBar, ActionFeedbackBanner, FeedbackState } from '../../components/admin/BulkActionBar';
import { ImageUploadField } from '../../components/admin/ImageUploadField';
import { deleteAssetByUrl } from '../../lib/mediaUpload';

const MODULE_CHOICES = ['News', 'Jobs', 'Scholarships', 'Tenders', 'Others'];

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [editUserTarget, setEditUserTarget] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [savingUserProfile, setSavingUserProfile] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser)));
    } catch (e) {
      console.error(e);
      setFeedback({ type: 'error', message: 'Failed to load user accounts.'});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const activeSuperAdmins = users.filter(u => u.role === 'super_admin'&& u.status === 'active');

  const getProtectionReason = (user: AdminUser): string | null => {
    if (user.id === auth.currentUser?.uid) {
      return 'You cannot delete your own active administrator account.';
    }
    if (user.email === 'emmanuelmuke58@gmail.com') {
      return 'Primary Super Admin account is protected.';
    }
    if (user.role === 'super_admin'&& user.status === 'active'&& activeSuperAdmins.length <= 1) {
      return 'Cannot delete the last active Super Admin account.';
    }
    return null;
  };

  const updateRole = async (userId: string, role: string) => {
    const target = users.find(u => u.id === userId);
    if (target?.role === 'super_admin'&& role !== 'super_admin'&& activeSuperAdmins.length <= 1) {
      setFeedback({ type: 'error', message: 'Cannot downgrade the last active Super Admin.'});
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      await logActivity('users', 'edit', `Updated user role to ${role}`, userId);
      setFeedback({ type: 'success', message: 'User role updated.'});
      fetchUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to update role.'});
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    if (user.id === auth.currentUser?.uid) {
      setFeedback({ type: 'error', message: 'You cannot suspend your own active account.'});
      return;
    }
    const newStatus = user.status === 'active'? 'suspended': 'active';
    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      await logActivity('users', 'edit', `Changed user status to ${newStatus}`, user.id);
      setFeedback({ type: 'success', message: `User ${user.email} is now ${newStatus}.` });
      fetchUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to update status.'});
    }
  };

  const toggleDeletePermission = async (user: AdminUser) => {
    const nextVal = !(user.canDelete ?? (user.role !== 'editor'));
    try {
      await updateDoc(doc(db, 'users', user.id), { canDelete: nextVal });
      await logActivity('users', 'edit', `Set delete permission to ${nextVal} for ${user.email}`, user.id);
      fetchUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to update delete permission.'});
    }
  };

  const toggleModule = async (user: AdminUser, mod: string) => {
    const current = user.assignedModules || [];
    const next = current.includes(mod) ? current.filter(m => m !== mod) : [...current, mod];
    try {
      await updateDoc(doc(db, 'users', user.id), { assignedModules: next });
      await logActivity('users', 'edit', `Updated assigned modules for ${user.email}: ${next.join(', ') || 'All'}`, user.id);
      fetchUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Failed to update assigned modules.'});
    }
  };

  const openEditProfile = (user: AdminUser) => {
    setEditUserTarget(user);
    setEditDisplayName(user.displayName || '');
    setEditAvatarUrl(user.avatarUrl || '');
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserTarget) return;
    setSavingUserProfile(true);
    try {
      const cleanName = editDisplayName.trim();
      const cleanAvatar = editAvatarUrl.trim();
      await updateDoc(doc(db, 'users', editUserTarget.id), {
        displayName: cleanName,
        avatarUrl: cleanAvatar,
      });
      await logActivity(
        'users',
        'edit',
        `Updated profile & avatar for ${editUserTarget.email}`,
        editUserTarget.id
      );
      setFeedback({ type: 'success', message: `Profile updated for ${editUserTarget.email}.` });
      setEditUserTarget(null);
      await fetchUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', message: extractErrorMessage(e, 'Failed to update user profile.') });
    } finally {
      setSavingUserProfile(false);
    }
  };

  const handleConfirmDelete = async (reason?: string) => {
    if (!deleteTarget) return;
    const guard = getProtectionReason(deleteTarget);
    if (guard) {
      setFeedback({ type: 'error', message: guard });
      throw new Error(guard);
    }
    try {
      await permanentDeleteRecord('users', deleteTarget.id, deleteTarget.email, 'users', reason);
      if (deleteTarget.avatarUrl) {
        deleteAssetByUrl(deleteTarget.avatarUrl).catch(() => {});
      }
      setFeedback({
        type: 'success',
        message: `User account "${deleteTarget.email}" permanently deleted. Historical audit logs have been preserved.`,
      });
      setDeleteTarget(null);
      await fetchUsers();
    } catch (e: any) {
      const msg = extractErrorMessage(e, 'Failed to delete user record.');
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }
  };

  const handleBulkDelete = async (reason?: string) => {
    const selected = users.filter(u => selectedIds.has(u.id));
    const deletable = selected.filter(u => !getProtectionReason(u));
    const skipped = selected.length - deletable.length;

    if (deletable.length === 0) {
      const msg = 'Selected accounts are protected (self or last Super Admin) and cannot be deleted.';
      setFeedback({ type: 'error', message: msg });
      throw new Error(msg);
    }

    const res = await bulkPermanentDeleteRecords(
      'users',
      deletable.map(u => ({ id: u.id, title: u.email })),
      'users',
      reason
    );

    const details = [...res.errors];
    if (skipped > 0) details.push(`${skipped} protected account(s) skipped.`);

    setFeedback({
      type: res.failed > 0 || skipped > 0 ? (res.succeeded > 0 ? 'warning': 'error') : 'success',
      message: `Deleted ${res.succeeded} user account(s).${skipped > 0 ? ` ${skipped} protected account(s) skipped.` : ''}`,
      details,
    });
    if (res.succeeded === 0 && res.failed > 0) {
      throw new Error(res.errors[0] || 'Failed to delete selected user accounts.');
    }
    setSelectedIds(new Set());
    for (const u of deletable) {
      if (u.avatarUrl) {
        deleteAssetByUrl(u.avatarUrl).catch(() => {});
      }
    }
    await fetchUsers();
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Loading users...</div>;

  const deletableUsers = users.filter(u => !getProtectionReason(u));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#102B4E]">User Management</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Manage roles, module permissions, and revoke user accounts. Historical audit logs are preserved on user deletion.</p>
      </div>

      <ActionFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <BulkActionBar
        selectedCount={selectedIds.size}
        pageCount={deletableUsers.length}
        totalFilteredCount={deletableUsers.length}
        allFilteredSelected={selectedIds.size === deletableUsers.length && deletableUsers.length > 0}
        onSelectPage={(checked) => setSelectedIds(checked ? new Set(deletableUsers.map(u => u.id)) : new Set())}
        onSelectAllFiltered={() => setSelectedIds(new Set(deletableUsers.map(u => u.id)))}
        onClearSelection={() => setSelectedIds(new Set())}
        onBulkDelete={() => setBulkDeleteOpen(true)}
      />

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const protection = getProtectionReason(user);
          const allowDeleteFlag = user.canDelete ?? (user.role !== 'editor');
          return (
            <div key={user.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    disabled={Boolean(protection)}
                    checked={selectedIds.has(user.id)}
                    onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(user.id)) next.delete(user.id);
                      else next.add(user.id);
                      setSelectedIds(next);
                    }}
                    className="w-4 h-4 mt-1 rounded border-slate-300 text-[#083D91] disabled:opacity-30 flex-shrink-0"
                  />
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden border border-slate-200">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName || user.email}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Mail size={16} />
                    )}
                  </div>
                  <div className="min-w-0">
                    {user.displayName && (
                      <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
                    )}
                    <p className={cn("break-all", user.displayName ? "text-xs text-slate-500" : "text-sm font-bold text-slate-900")}>{user.email}</p>
                    <p className="text-[10px] text-slate-400 font-mono break-all mt-0.5">UID: {user.id}</p>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex-shrink-0",
                  user.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                )}>
                  {user.status === 'active' ? <CheckCircle2 size={11} /> : <ShieldAlert size={11} />}
                  {user.status}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Role</label>
                  <select
                    className="w-full min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-[#083D91] focus:outline-none"
                    value={user.role}
                    disabled={user.email === 'emmanuelmuke58@gmail.com'}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="user">User</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Permissions & Modules</label>
                  {(user.role === 'editor' || user.role === 'content_manager') ? (
                    <div className="space-y-2.5">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowDeleteFlag}
                          onChange={() => toggleDeletePermission(user)}
                          className="w-4 h-4 rounded text-teal-600"
                        />
                        Can Soft-Delete {user.role === 'editor' ? 'Own Content' : 'Assigned Modules'}
                      </label>
                      {user.role === 'content_manager' && (
                        <div className="flex flex-wrap gap-1.5">
                          {MODULE_CHOICES.map(mod => {
                            const active = (user.assignedModules || []).includes(mod);
                            return (
                              <button
                                key={mod}
                                type="button"
                                onClick={() => toggleModule(user, mod)}
                                className={cn(
                                  "min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                                  active ? "bg-[#083D91] text-white" : "bg-slate-100 text-slate-500"
                                )}
                              >
                                {mod}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      {user.role === 'super_admin' ? 'Full Access (incl. Permanent Delete)' : user.role === 'admin' ? 'Soft Delete & Restore' : 'No Admin Access'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openEditProfile(user)}
                  className="min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
                >
                  <Edit size={14} /> Photo / Name
                </button>
                <button
                  onClick={() => toggleStatus(user)}
                  className={cn(
                    "min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all",
                    user.status === 'active' ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  )}
                >
                  {user.status === 'active' ? <ShieldAlert size={15} /> : <CheckCircle2 size={15} />}
                  {user.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
                {protection ? (
                  <span className="min-h-[40px] px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-not-allowed" title={protection}>
                    <Lock size={14} /> Protected
                  </span>
                ) : (
                  <button
                    onClick={() => setDeleteTarget(user)}
                    className="min-h-[40px] px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center text-slate-400 italic">No users found.</div>
        )}
      </div>

      {/* Tablet & Desktop Table */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[780px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="w-10 px-5 py-4"></th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delete Permission / Modules</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-5 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((user) => {
              const protection = getProtectionReason(user);
              const allowDeleteFlag = user.canDelete ?? (user.role !== 'editor');

              return (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <input
                      type="checkbox" disabled={Boolean(protection)}
                      checked={selectedIds.has(user.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(user.id)) next.delete(user.id);
                        else next.add(user.id);
                        setSelectedIds(next);
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-[#083D91] disabled:opacity-30"/>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 flex-shrink-0 overflow-hidden border border-slate-200">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.displayName || user.email}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Mail size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        {user.displayName && (
                          <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
                        )}
                        <p className={cn("break-all", user.displayName ? "text-xs text-slate-500" : "text-sm font-bold text-slate-900")}>{user.email}</p>
                        <p className="text-[10px] text-slate-400 font-mono break-all">UID: {user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#083D91] focus:outline-none" value={user.role}
                      disabled={user.email === 'emmanuelmuke58@gmail.com'}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="content_manager">Content Manager</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    {(user.role === 'editor'|| user.role === 'content_manager') ? (
                      <div className="space-y-2">
                        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                          <input
                            type="checkbox" checked={allowDeleteFlag}
                            onChange={() => toggleDeletePermission(user)}
                            className="w-3.5 h-3.5 rounded text-teal-600"/>
                          Can Soft-Delete {user.role === 'editor'? 'Own Content': 'Assigned Modules'}
                        </label>
                        {user.role === 'content_manager'&& (
                          <div className="flex flex-wrap gap-1">
                            {MODULE_CHOICES.map(mod => {
                              const active = (user.assignedModules || []).includes(mod);
                              return (
                                <button
                                  key={mod}
                                  type="button" onClick={() => toggleModule(user, mod)}
                                  className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                                    active ? "bg-[#083D91] text-white": "bg-slate-100 text-slate-500")}
                                >
                                  {mod}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {user.role === 'super_admin'? 'Full Access (incl. Permanent Delete)': user.role === 'admin'? 'Soft Delete & Restore': 'No Admin Access'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      user.status === 'active'? "bg-emerald-50 text-emerald-600": "bg-red-50 text-red-600")}>
                      {user.status === 'active'? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                      {user.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditProfile(user)}
                        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#083D91] transition-all"
                        title="Edit Photo & Display Name"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => toggleStatus(user)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          user.status === 'active'? "text-amber-500 hover:bg-amber-50": "text-emerald-500 hover:bg-emerald-50")}
                        title={user.status === 'active'? 'Suspend': 'Activate'}
                      >
                        {user.status === 'active'? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
                      </button>
                      {protection ? (
                        <span className="px-2.5 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-not-allowed" title={protection}>
                          <Lock size={13} /> Protected
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all">
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic">No users found.</div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete User Account?" itemName={deleteTarget?.email}
        description="Immediate security revocation: deleting this account revokes all Admin Dashboard access immediately while preserving historical audit logs." confirmLabel="Delete User"isPermanent
        requireTypeDelete
      />

      <DeleteConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title={`Delete ${selectedIds.size} Selected User Accounts?`}
        description="All selected accounts will have their access permanently revoked. Your own account and the last Super Admin are automatically protected." confirmLabel="Delete Users"isPermanent
        requireTypeDelete
      />

      {editUserTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#102B4E]">Edit User Profile & Avatar</h3>
                <p className="text-xs text-slate-400">{editUserTarget.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditUserTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUserProfile} className="p-6 space-y-5 overflow-y-auto">
              <ImageUploadField
                label="User Profile Photo"
                kind="avatar"
                aspectHint="1:1"
                cameraFacing="user"
                registerMedia={false}
                value={editAvatarUrl}
                onChange={(url) => setEditAvatarUrl(url)}
                helperText="Upload from device or camera and crop to a circular avatar."
              />

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Full name or editorial byline"
                  className="w-full min-h-[44px] px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserTarget(null)}
                  className="min-h-[42px] px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUserProfile}
                  className="min-h-[42px] px-6 py-2 bg-[#083D91] hover:bg-[#07366D] text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                >
                  {savingUserProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
