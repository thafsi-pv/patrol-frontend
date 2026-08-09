import { useState } from 'react';
import { useUsers, useCreateUser } from '../hooks/useUsers';

export function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const createMutation = useCreateUser();

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'GUARD' as 'ADMIN' | 'GUARD', mobileNumber: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await createMutation.mutateAsync({
        ...form,
        mobileNumber: form.mobileNumber || undefined,
      });
      setShowModal(false);
      setForm({ name: '', email: '', password: '', role: 'GUARD', mobileNumber: '' });
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Failed to create user');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Users</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Manage guard and admin accounts.</p>
        </div>
        <button id="btn-new-user" onClick={() => setShowModal(true)} className="btn-primary w-full sm:w-auto shrink-0">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span>Add User</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-600">
            <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
            Loading users…
          </div>
        ) : !users?.length ? (
          <div className="p-16 text-center text-gray-600">
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Device Bound</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="table-row-hover">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-700/50 flex items-center justify-center text-xs font-bold text-brand-300 shrink-0">
                          {user.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-200">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-400">{user.email}</td>
                    <td className="px-5 py-4 text-gray-400">{(user as any).mobileNumber || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={`badge ${user.role === 'ADMIN'
                        ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                        : 'bg-gray-500/15 text-gray-400 border border-gray-500/30'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`badge ${user.deviceId
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-gray-500/10 text-gray-600 border border-gray-700'}`}>
                        {user.deviceId ? 'Yes' : 'Not yet'}
                      </span>
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative card w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">Add User</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="label">Full Name *</label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith" />
              </div>

              <div>
                <label className="label">Email *</label>
                <input className="input" required type="email" value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com" />
              </div>

              <div>
                <label className="label">Password *</label>
                <input className="input" required type="password" minLength={8} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters" />
              </div>

              <div>
                <label className="label">Mobile Number (WhatsApp) *</label>
                <input className="input" required type="tel" value={form.mobileNumber}
                  onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                  placeholder="e.g. +919876543210" />
              </div>

              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'GUARD' }))}>
                  <option value="GUARD">Guard</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
