import React, { useState } from 'react';
import { User, AlertCircle, Loader2, CheckCircle, ShieldAlert, Lock } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileInitializationProps {
  user: UserProfile;
  onSuccess: (updatedProfile: UserProfile) => void;
}

export default function ProfileInitialization({ user, onSuccess }: ProfileInitializationProps) {
  const [name, setName] = useState(user.name || '');
  const [initials, setInitials] = useState(user.initials || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const cleanInitials = initials.trim().toUpperCase();
    if (cleanInitials.length < 2 || cleanInitials.length > 3) {
      setError('Name initials must be exactly 2 or 3 letters long.');
      return;
    }

    if (password) {
      if (password.length < 4) {
        setError('Password must be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/user/confirm-initials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          name: name.trim(),
          initials: cleanInitials,
          password: password ? password.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize profile.');
      }

      setSuccess('Profile initialized and locked successfully! Loading your dashboard...');
      
      // Update the local storage item for subsequent sessions
      localStorage.setItem('form_collect_user', JSON.stringify(data.user));

      setTimeout(() => {
        onSuccess(data.user);
      }, 1500);
    } catch (err: any) {
      console.error('Error confirming initials:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12 bg-[#09090b]">
      <div className="w-full max-w-md bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xs">
        
        {/* Header Decors */}
        <div className="bg-indigo-600/10 border-b border-zinc-800/80 px-6 py-8 text-center text-zinc-100 relative">
          <div className="mx-auto w-12 h-12 bg-indigo-600/20 border border-indigo-500/30 rounded-xl flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 font-sans">Initialize Profile</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Setup your signature initials for secure sequence tracking.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-8">
          <div className="mb-6 p-3.5 bg-indigo-950/20 border border-indigo-900/40 rounded-xl text-xs text-indigo-400 leading-relaxed font-sans flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>Crucial Security Step:</strong> Because this is your first login, you must confirm your name and initials. You can also change your password now. Once set, <strong>your initials cannot be changed</strong> by you unless an Administrator performs a manual override.
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 text-rose-400 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/50 text-emerald-400 text-xs flex items-start space-x-2.5">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600"
                disabled={isLoading || !!success}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                  Your Signature Initials
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">2-3 letters</span>
              </div>
              <input
                type="text"
                required
                maxLength={3}
                value={initials}
                onChange={(e) => setInitials(e.target.value)}
                placeholder="e.g. JD"
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm font-bold tracking-wider uppercase text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-600 font-mono"
                disabled={isLoading || !!success}
              />
              <p className="text-[10px] text-zinc-500 mt-1.5 leading-normal">
                These initials will prefix all your submitted files, for example: <strong>{initials.toUpperCase() || 'JD'}_EXP_1001.pdf</strong>
              </p>
            </div>

            <div className="border-t border-zinc-800/60 my-4 pt-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                    <Lock className="w-4 h-4 text-zinc-500" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-650"
                    disabled={isLoading || !!success}
                  />
                </div>
              </div>

              {password && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5 font-mono">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
                      <Lock className="w-4 h-4 text-zinc-500" />
                    </span>
                    <input
                      type="password"
                      required={!!password}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Verify your new password"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-650"
                      disabled={isLoading || !!success}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 flex items-center justify-center space-x-2 cursor-pointer"
              disabled={isLoading || !!success}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Profile Initials...</span>
                </>
              ) : (
                <span>Confirm & Set Initials</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
