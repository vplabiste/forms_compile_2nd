import React, { useState, useEffect } from 'react';
import { auth, db, signInWithCustomToken, doc, getDoc, collection, getDocs, setDoc } from '../lib/firebaseClient';
import { Mail, Lock, User, UserPlus, FileText, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginViewProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // First time setup states
  const [isDbEmpty, setIsDbEmpty] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupInitials, setSetupInitials] = useState('');
  const [setupSuccess, setSetupSuccess] = useState<string | null>(null);

  // Check if any users exist in the database on mount
  useEffect(() => {
    checkUsersStatus();
  }, []);

  const checkUsersStatus = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      if (querySnapshot.docs.length === 0) {
        setIsDbEmpty(true);
        setIsSetupMode(true);
      } else {
        setIsDbEmpty(false);
        setIsSetupMode(false);
      }
    } catch (err) {
      console.error('Error checking users status:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      let userDoc = querySnapshot.docs.find(
        (d) => (d.data() as any).email?.toLowerCase() === email.trim().toLowerCase()
      );

      if (!userDoc) {
        throw new Error('Invalid email or password.');
      }

      const existingData = userDoc.data() as any;
      if (existingData.password !== password) {
        throw new Error('Invalid email or password.');
      }

      const profile: UserProfile = {
        uid: existingData.uid || userDoc.id,
        email: existingData.email,
        password: existingData.password,
        name: existingData.name,
        initials: existingData.initials,
        role: existingData.role,
        initialsConfirmed: existingData.initialsConfirmed ?? false
      };

      // Establish client auth state
      await signInWithCustomToken(auth, JSON.stringify(profile));

      // Return the authenticated profile
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupName || !setupEmail || !setupPassword || !setupInitials) {
      setError('Please fill out all setup fields.');
      return;
    }

    if (setupInitials.length < 2 || setupInitials.length > 3) {
      setError('Initials must be 2 or 3 letters long.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      if (querySnapshot.docs.length > 0) {
        throw new Error('Users already exist in the database. Please login instead.');
      }

      const uid = 'user_' + Math.random().toString(36).substring(2, 11);
      const newAdmin: UserProfile = {
        uid,
        email: setupEmail.trim(),
        password: setupPassword,
        name: setupName.trim(),
        initials: setupInitials.trim().toUpperCase(),
        role: 'Admin',
        initialsConfirmed: true
      };

      // Save directly to Firestore
      await setDoc(doc(db, 'users', uid), newAdmin);

      setSetupSuccess('First Admin user created successfully! You can now login with these credentials.');
      setEmail(setupEmail);
      setPassword(setupPassword);
      setIsSetupMode(false);
      setIsDbEmpty(false);
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'Failed to complete first-time setup.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-[#09090b]">
      <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 backdrop-blur-xs">
        
        {/* Header decoration */}
        <div className="bg-indigo-600/10 border-b border-zinc-800/80 px-6 py-8 text-center text-zinc-100 relative">
          <div className="absolute top-3 right-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-widest uppercase">
            v1.0
          </div>
          <div className="mx-auto w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-3">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100">Forms Collect & Compile</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            {isSetupMode ? 'System Initialization Setup' : 'Role-Based Secure Document Gateway'}
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 text-rose-400 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {setupSuccess && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 text-sm flex items-start space-x-2.5">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{setupSuccess}</span>
            </div>
          )}

          {isSetupMode ? (
            /* First Time Setup Mode */
            <form onSubmit={handleSetupFirstAdmin} className="space-y-4" id="form-setup-admin">
              <div className="p-3.5 bg-amber-950/20 border border-amber-900/50 text-amber-400 text-xs rounded-xl mb-4 leading-relaxed">
                <strong>First-time Installation Detected:</strong> No accounts exist yet. Please create the initial system <strong>Admin</strong> user below.
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Admin Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="John Doe"
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
                      value={setupEmail}
                      onChange={(e) => setSetupEmail(e.target.value)}
                      placeholder="admin@company.com"
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
                    value={setupInitials}
                    onChange={(e) => setSetupInitials(e.target.value)}
                    placeholder="JD"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none text-center font-bold tracking-wider uppercase focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 font-mono"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  Secure Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                disabled={isLoading}
                id="btn-submit-setup"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deploying Admin User...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Initialize Admin & Start</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Standard Login Mode */
            <form onSubmit={handleLogin} className="space-y-4" id="form-login">
              <div>
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
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                    Password
                  </label>
                </div>
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

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
                disabled={isLoading}
                id="btn-submit-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <span>Sign In Securely</span>
                )}
              </button>

              {isDbEmpty && (
                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSetupMode(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-mono hover:underline font-medium cursor-pointer"
                  >
                    Return to First-Time Setup
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
