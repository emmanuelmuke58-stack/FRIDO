import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { AdminUser } from '../../types';
import { Users, Shield, ShieldAlert, Trash2, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { logActivity } from '../../lib/services';
import { cn } from '../../lib/utils';

export function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminUser)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const updateRole = async (userId: string, role: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role });
      await logActivity('users', 'edit', `Updated user role to ${role}`, userId);
      fetchUsers();
    } catch (e) {
      alert('Failed to update role');
    }
  };

  const toggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.id), { status: newStatus });
      await logActivity('users', 'edit', `Changed user status to ${newStatus}`, user.id);
      fetchUsers();
    } catch (e) {
      alert('Failed to update status');
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse">Loading users...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold text-[#102B4E] font-montserrat">User Management</h1>
        <p className="text-slate-500 mt-1">Manage administrator access and permissions.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">User</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Role</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <Mail size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{user.email}</p>
                      <p className="text-[10px] text-slate-400 font-mono">UID: {user.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select 
                    className="bg-transparent text-sm font-bold text-[#083D91] focus:outline-none"
                    value={user.role}
                    onChange={(e) => updateRole(user.id, e.target.value)}
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="content_manager">Content Manager</option>
                    <option value="user">User</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    user.status === 'active' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {user.status === 'active' ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => toggleStatus(user)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        user.status === 'active' ? "text-amber-500 hover:bg-amber-50" : "text-emerald-500 hover:bg-emerald-50"
                      )}
                      title={user.status === 'active' ? 'Suspend' : 'Activate'}
                    >
                      {user.status === 'active' ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete user record?')) {
                          await deleteDoc(doc(db, 'users', user.id));
                          await logActivity('users', 'delete', `Deleted user: ${user.email}`, user.id);
                          fetchUsers();
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-20 text-center text-slate-400 italic">No users found.</div>
        )}
      </div>
    </div>
  );
}
