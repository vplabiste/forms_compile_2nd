import React, { useState, useEffect } from 'react';
import { db, auth, collection, query, getDocs, orderBy } from '../lib/firebaseClient';
import { UserPlus, Shield, User, Mail, Lock, KeyRound, Loader2, AlertCircle, CheckCircle2, RefreshCw, Users, Pencil, X } from 'lucide-react';
import { UserProfile, UserRole } from '../types';

export default function AdminDashboard() {
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initials, setInitials] = useState('');
  const [role, setRole] = useState<UserRole>('Employee');

  // List of users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User editing states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editInitials, setEditInitials] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Employee');
  const [editPassword, setEditPassword] = useState('');

  const startEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditInitials(u.initials);
    setEditRole(u.role);
    setEditPassword('');
    setError(null);
    setSuccess(null);
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setEditName('');
    setEditInitials('');
    setEditRole('Employee');
    setEditPassword('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (!editName.trim() || !editInitials.trim() || !editRole) {
      setError('Name, Initials, and Role are required.');
      return;
    }

    if (editInitials.trim().length < 2 || editInitials.trim().length > 3) {
      setError('Initials must be 2 or 3 letters long.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: editingUser.uid,
          name: editName.trim(),
          initials: editInitials.trim().toUpperCase(),
          role: editRole,
          password: editPassword.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user.');
      }

      setSuccess(`User "${editName}" updated successfully!`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Error updating user:', err);
      setError(err.message || 'An error occurred while updating the user.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const fetchedUsers: UserProfile[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as UserProfile);
      });
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !initials || !role) {
      setError('All fields are required.');
      return;
    }

    if (initials.length < 2 || initials.length > 3) {
      setError('Initials must be 2 or 3 letters long.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get Firebase Auth ID Token for the currently logged-in Admin
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('Not authenticated. Please log in again.');
      }

      // Call our Express endpoint
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          initials: initials.trim().toUpperCase(),
          role,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`User "${name}" (${role}) registered successfully!`);
      
      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setInitials('');
      setRole('Employee');

      // Refresh list
      fetchUsers();
    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message || 'An error occurred while creating the user.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeColor = (userRole: UserRole) => {
    switch (userRole) {
      case 'Admin':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Manager':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Introduction Header */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 text-white rounded-2xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">Admin Control Panel</h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
            Securely register and manage system roles. Accounts created here are automatically provisioned in both Firebase Auth and our custom Firestore profile directory.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-zinc-300 text-xs font-mono">
          <Shield className="w-4 h-4 text-rose-400 animate-pulse" />
          <span className="font-semibold text-zinc-300">Admin Mode Enabled</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* User Registration Card */}
        <div className="lg:col-span-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl h-fit backdrop-blur-xs">
          <div className="flex items-center space-x-2.5 mb-6 pb-4 border-b border-zinc-800/80">
            <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-100 text-sm tracking-wide">Provision New Account</h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Self-registration is disabled</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-950/25 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-900/50 text-emerald-400 text-xs flex items-start space-x-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleRegisterUser} className="space-y-4" id="form-register-user">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@company.com"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Initials
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  value={initials}
                  onChange={(e) => setInitials(e.target.value)}
                  placeholder="JD"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none text-center font-bold tracking-wider uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                System Authorization Role
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none text-zinc-300"
                  disabled={isLoading}
                >
                  <option value="Employee">Employee (Form Uploader)</option>
                  <option value="Manager">Manager (Viewer, Editor, Compiler)</option>
                  <option value="Admin">Admin (Full System Manager)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
              disabled={isLoading}
              id="btn-register-user"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Provisioning Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Directory List Card */}
        <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl flex flex-col h-[540px] backdrop-blur-xs">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="bg-zinc-950 text-zinc-400 p-2 rounded-lg border border-zinc-800/50">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-zinc-100 font-sans text-sm tracking-wide">Active Directories</h2>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">List of registered system users</p>
              </div>
            </div>

            <button
              onClick={fetchUsers}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 border border-zinc-800/80 transition-colors cursor-pointer bg-zinc-950"
              title="Refresh User List"
              disabled={loadingUsers}
            >
              <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Directory table */}
          <div className="overflow-y-auto flex-1 min-h-0 border border-zinc-800/80 rounded-xl bg-zinc-950/20">
            {loadingUsers && users.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2 font-mono">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="text-xs font-semibold">Retrieving active user records...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-6 text-center">
                <Shield className="w-10 h-10 text-zinc-700 mb-2" />
                <span className="text-sm font-semibold text-zinc-300">No User Profiles Found</span>
                <p className="text-xs text-zinc-500 mt-1.5 max-w-xs leading-relaxed">
                  Create a new Employee or Manager using the form on the left.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/40 text-zinc-500 font-bold text-[11px] uppercase tracking-widest border-b border-zinc-800/60 font-mono">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Initials</th>
                    <th className="py-3 px-4">Role Permission</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-zinc-200 text-sm">{u.name}</div>
                        <div className="text-xs text-zinc-500 font-mono mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-zinc-300 text-sm">
                        {u.initials}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getRoleBadgeColor(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => startEditUser(u)}
                          className="p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 rounded-lg transition-all cursor-pointer inline-flex items-center space-x-1"
                          title="Edit User"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1">Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* Edit User Modal Overlay */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-fade-in">
            {/* Header */}
            <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Pencil className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="text-zinc-200 font-bold text-sm tracking-wide">Edit User Account</h3>
              </div>
              <button
                onClick={cancelEditUser}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Form */}
            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 font-mono">
                    Email (Read Only)
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingUser.email}
                    className="w-full px-3 py-2.5 bg-zinc-950/50 border border-zinc-850 rounded-lg text-zinc-500 text-sm select-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                    Initials
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={editInitials}
                    onChange={(e) => setEditInitials(e.target.value)}
                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm font-bold tracking-wider uppercase text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-650"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  System Authorization Role
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none text-zinc-300"
                  >
                    <option value="Employee">Employee (Form Uploader)</option>
                    <option value="Manager">Manager (Viewer, Editor, Compiler)</option>
                    <option value="Admin">Admin (Full System Manager)</option>
                  </select>
                </div>
              </div>

              {/* Security Hint */}
              <div className="p-3 bg-zinc-950/65 rounded-xl border border-zinc-800 text-[10.5px] text-zinc-450 leading-relaxed font-sans">
                <strong>Administrative Note:</strong> Altering initials updates the prefix schema for all future sequence tracking operations for this account. Past sequence records remain unchanged.
              </div>

              {/* Actions Footer */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelEditUser}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg text-xs transition-all cursor-pointer text-center"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center space-x-1 cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
