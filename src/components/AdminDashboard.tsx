import React, { useState, useEffect } from 'react';
import { db, auth, collection, query, getDocs, orderBy, doc, setDoc, deleteDoc } from '../lib/firebaseClient';
import { UserPlus, Shield, User, Mail, Lock, KeyRound, Loader2, AlertCircle, CheckCircle2, RefreshCw, Users, Pencil, X, Trash2, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserProfile, UserRole, ActivityLog } from '../types';

interface AdminDashboardProps {
  currentUser?: UserProfile | null;
}

export default function AdminDashboard({ currentUser }: AdminDashboardProps) {
  // Navigation State
  const [adminTab, setAdminTab] = useState<'users' | 'logs'>('users');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initials, setInitials] = useState('');
  const [role, setRole] = useState<UserRole>('Employee');

  // List of users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersFetchError, setUsersFetchError] = useState<string | null>(null);

  // System Activity Logs states
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsFetchError, setLogsFetchError] = useState<string | null>(null);

  // Log filter states
  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState<string>('All');
  const [logRole, setLogRole] = useState<string>('All');

  // Log pagination states
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 15;

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

  // User deletion states
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);

  const confirmDeleteUser = (u: UserProfile) => {
    if (currentUser?.uid === u.uid) {
      setError('You cannot delete your own account.');
      return;
    }
    setDeletingUser(u);
    setError(null);
    setSuccess(null);
  };

  const cancelDeleteUser = () => {
    setDeletingUser(null);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await deleteDoc(doc(db, 'users', deletingUser.uid));
      setSuccess(`User "${deletingUser.name}" deleted successfully!`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      setError(err.message || 'An error occurred while deleting the user.');
    } finally {
      setIsLoading(false);
    }
  };

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
      const updatedUser: UserProfile = {
        ...editingUser,
        name: editName.trim(),
        initials: editInitials.trim().toUpperCase(),
        role: editRole,
      };
      if (editPassword.trim()) {
        updatedUser.password = editPassword.trim();
      }

      // Write directly to Firestore!
      await setDoc(doc(db, 'users', editingUser.uid), updatedUser);

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
    setUsersFetchError(null);
    try {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      const fetchedUsers: UserProfile[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as UserProfile);
      });
      setUsers(fetchedUsers);
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      console.error('Error fetching users:', { error: err, isPermissionDenied });
      if (isPermissionDenied) {
        setUsersFetchError('Missing or insufficient permissions to fetch users. Ensure you are an Admin.');
      } else {
        setUsersFetchError('Error fetching users: ' + (err.message || err));
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsFetchError(null);
    try {
      const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetchedLogs: ActivityLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        fetchedLogs.push({
          id: doc.id,
          action: data.action,
          performedBy: data.performedBy,
          performedByRole: data.performedByRole,
          details: data.details,
          createdAt: data.createdAt
        });
      });
      setActivityLogs(fetchedLogs);
    } catch (err: any) {
      const isPermissionDenied = err.code === 'permission-denied' || 
                                 (err.message && err.message.toLowerCase().includes('permission')) ||
                                 JSON.stringify(err).toLowerCase().includes('permission');
      console.error('Error fetching system logs:', { error: err, isPermissionDenied });
      if (isPermissionDenied) {
        setLogsFetchError('Missing or insufficient permissions to fetch system logs. Ensure you are an Admin.');
      } else {
        setLogsFetchError('Error fetching system logs: ' + (err.message || err));
      }
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (adminTab === 'logs') {
      fetchLogs();
    }
  }, [adminTab]);

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
      // Check if user already exists in Firestore
      const querySnapshot = await getDocs(collection(db, 'users'));
      const exists = querySnapshot.docs.some(
        (d) => (d.data() as any).email?.toLowerCase() === email.trim().toLowerCase()
      );
      if (exists) {
        throw new Error('A user with this email already exists.');
      }

      const uid = 'user_' + Math.random().toString(36).substring(2, 11);
      const newUser: UserProfile = {
        uid,
        name: name.trim(),
        email: email.trim(),
        password,
        initials: initials.trim().toUpperCase(),
        role: role as any,
        initialsConfirmed: false
      };

      // Write directly to Firestore!
      await setDoc(doc(db, 'users', uid), newUser);

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

  // Filter and paginated logs
  const filteredLogs = activityLogs.filter((log) => {
    const searchLower = logSearch.toLowerCase();
    const matchesSearch =
      !logSearch ||
      log.performedBy.toLowerCase().includes(searchLower) ||
      (log.performedByRole && log.performedByRole.toLowerCase().includes(searchLower)) ||
      log.details.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower);

    const matchesAction = logAction === 'All' || log.action === logAction;
    const matchesRole = logRole === 'All' || log.performedByRole === logRole;

    return matchesSearch && matchesAction && matchesRole;
  });

  const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (logPage - 1) * logsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + logsPerPage);

  const formatLogTimestamp = (ts: any) => {
    if (!ts) return 'Just now';
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString();
    }
    if (ts.toDate) {
      return ts.toDate().toLocaleString();
    }
    return new Date(ts).toLocaleString();
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-zinc-800/80">
        <button
          onClick={() => { setAdminTab('users'); setError(null); setSuccess(null); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            adminTab === 'users'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User & Directory Management</span>
        </button>
        <button
          onClick={() => { setAdminTab('logs'); setError(null); setSuccess(null); setLogPage(1); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center space-x-2 ${
            adminTab === 'logs'
              ? 'border-indigo-500 text-indigo-400 font-bold bg-indigo-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin text-indigo-400' : ''}`} />
          <span>System Activity Audit Log</span>
        </button>
      </div>

      {adminTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in-50 duration-200">
        
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

          {usersFetchError && (
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-red-400 text-xs flex items-start space-x-3 leading-relaxed font-mono m-4">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Authorization Error:</strong> {usersFetchError}
                <div className="mt-2">
                  <button 
                    onClick={fetchUsers}
                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Retry Loading Users
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Directory table */}
          {!usersFetchError && (
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
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => startEditUser(u)}
                            className="p-1.5 bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/50 rounded-lg transition-all cursor-pointer inline-flex items-center space-x-1"
                            title="Edit User"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1">Edit</span>
                          </button>
                          
                          <button
                            onClick={() => confirmDeleteUser(u)}
                            disabled={currentUser?.uid === u.uid}
                            className={`p-1.5 border rounded-lg transition-all cursor-pointer inline-flex items-center space-x-1 ${
                              currentUser?.uid === u.uid
                                ? 'bg-zinc-950/40 border-zinc-900 text-zinc-650 cursor-not-allowed opacity-50'
                                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/50'
                            }`}
                            title={currentUser?.uid === u.uid ? "Cannot delete your own account" : "Delete User"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
        </div>

      </div>
      ) : (
        /* Render System Activity Logs tab contents */
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 animate-in fade-in-50 duration-200 backdrop-blur-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-lg border border-indigo-500/20">
                <RefreshCw className={`w-5 h-5 ${loadingLogs ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h2 className="font-bold text-zinc-100 text-sm tracking-wide">System Activity Audit Log</h2>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Immutable tracking of downloads, deletes, uploads, and archiving of files</p>
              </div>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loadingLogs}
              className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white flex items-center space-x-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
          </div>

          {/* Log Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={logSearch}
                onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                placeholder="Search logs by file or performer..."
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-zinc-650"
              />
            </div>

            {/* Action filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Filter className="w-3.5 h-3.5" />
              </span>
              <select
                value={logAction}
                onChange={(e) => { setLogAction(e.target.value); setLogPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-350 text-xs focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="All">All Logged Actions</option>
                <option value="Upload">Upload Action</option>
                <option value="Download">Download Action</option>
                <option value="Delete">Delete Action</option>
                <option value="Archive">Archive Action</option>
                <option value="Restore">Restore Action</option>
              </select>
            </div>

            {/* Role Filter */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                <Shield className="w-3.5 h-3.5" />
              </span>
              <select
                value={logRole}
                onChange={(e) => { setLogRole(e.target.value); setLogPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-350 text-xs focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="All">All User Roles</option>
                <option value="Employee">Employee (Form Uploader)</option>
                <option value="Manager">Manager (Viewer / Compiler)</option>
                <option value="Admin">Admin (Full System Manager)</option>
              </select>
            </div>
          </div>

          {/* Reset Filters Prompt */}
          {(logSearch || logAction !== 'All' || logRole !== 'All') && (
            <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-950 border border-zinc-850 rounded-lg text-xs">
              <span className="text-zinc-450 font-medium font-sans">
                Active filters matching <strong className="text-indigo-400 font-mono font-bold">{filteredLogs.length}</strong> activity log entries
              </span>
              <button
                onClick={() => { setLogSearch(''); setLogAction('All'); setLogRole('All'); setLogPage(1); }}
                className="text-indigo-400 hover:text-indigo-300 font-bold font-sans cursor-pointer transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Logs Table */}
          {logsFetchError && (
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/50 text-red-400 text-xs flex items-start space-x-3 leading-relaxed font-mono">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong>Authorization Error:</strong> {logsFetchError}
                <div className="mt-2">
                  <button 
                    onClick={fetchLogs}
                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Retry Loading Logs
                  </button>
                </div>
              </div>
            </div>
          )}

          {!logsFetchError && loadingLogs && activityLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 space-y-2 font-mono">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-semibold">Retrieving activity logs from Firestore...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-zinc-500 px-6 text-center">
              <AlertCircle className="w-12 h-12 text-zinc-700 mb-2" />
              <span className="text-sm font-semibold text-zinc-350">No Activity Logs Found</span>
              <p className="text-xs text-zinc-550 mt-1.5 max-w-sm mx-auto leading-relaxed font-sans">
                No activity records matched the specified filter criteria. Modify your keyword search or filter presets.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/20">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-500 font-bold text-[10px] uppercase tracking-widest font-mono">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Performed By</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-xs text-zinc-300 font-sans">
                    {paginatedLogs.map((log) => {
                      let actionBadgeColor = 'bg-zinc-950 text-zinc-400 border-zinc-800';
                      if (log.action === 'Upload') {
                        actionBadgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      } else if (log.action === 'Delete') {
                        actionBadgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                      } else if (log.action === 'Download') {
                        actionBadgeColor = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                      } else if (log.action === 'Archive') {
                        actionBadgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
                      } else if (log.action === 'Restore') {
                        actionBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      }

                      return (
                        <tr key={log.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                            {formatLogTimestamp(log.createdAt)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider rounded-md border ${actionBadgeColor}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="block font-sans font-semibold text-zinc-100">{log.performedBy}</span>
                            <span className="text-[10px] font-mono text-zinc-500">{log.performedByRole || 'System'}</span>
                          </td>
                          <td className="py-3.5 px-4 font-sans text-zinc-400 max-w-md break-words leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Log Pagination Bar */}
              {totalLogPages > 1 && (
                <div className="bg-zinc-950 px-6 py-4 border border-zinc-850 rounded-xl flex items-center justify-between">
                  <div className="text-xs text-zinc-500 font-semibold font-sans">
                    Showing logs <strong className="text-zinc-300 font-bold font-mono">{startIndex + 1}</strong> to{' '}
                    <strong className="text-zinc-300 font-bold font-mono">
                      {Math.min(startIndex + logsPerPage, filteredLogs.length)}
                    </strong>{' '}
                    of <strong className="text-zinc-300 font-bold font-mono">{filteredLogs.length}</strong> total matched entries
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setLogPage(prev => Math.max(prev - 1, 1))}
                      disabled={logPage === 1}
                      className="p-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold text-zinc-400 px-1 font-mono">
                      {logPage} / {totalLogPages}
                    </span>
                    <button
                      onClick={() => setLogPage(prev => Math.min(prev + 1, totalLogPages))}
                      disabled={logPage === totalLogPages}
                      className="p-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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

      {/* Delete User Modal Overlay */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-900/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-fade-in">
            {/* Header */}
            <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-4.5 h-4.5 text-rose-500" />
                <h3 className="text-zinc-200 font-bold text-sm tracking-wide">Delete User Account</h3>
              </div>
              <button
                onClick={cancelDeleteUser}
                className="p-1 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800/50 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-rose-300">Are you absolutely sure?</h4>
                  <p className="text-xs text-rose-400/80 leading-relaxed">
                    This action is permanent and cannot be undone. This will delete the user account profile from Cloud Firestore immediately.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 space-y-2">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">User to Delete</div>
                <div>
                  <div className="text-sm font-semibold text-zinc-200">{deletingUser.name}</div>
                  <div className="text-xs text-zinc-550 font-mono mt-0.5">{deletingUser.email}</div>
                </div>
                <div className="pt-2 border-t border-zinc-850 flex justify-between text-xs">
                  <span className="text-zinc-400">System Role:</span>
                  <span className="font-semibold text-zinc-300">{deletingUser.role}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Initials:</span>
                  <span className="font-mono font-bold text-zinc-300">{deletingUser.initials}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelDeleteUser}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg text-xs transition-all cursor-pointer text-center"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-lg text-xs transition-all shadow-md flex items-center justify-center space-x-1 cursor-pointer"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Permanently</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
