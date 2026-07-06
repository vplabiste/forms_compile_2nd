import { LogOut, User, Shield, Briefcase, FileText } from 'lucide-react';
import { auth, signOut } from '../lib/firebaseClient';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Admin':
        return <Shield className="w-4 h-4 text-rose-400" />;
      case 'Manager':
        return <Briefcase className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <nav className="bg-[#09090b]/85 border-b border-zinc-900 sticky top-0 z-50 shadow-md backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/15">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="font-sans font-bold text-lg tracking-tight text-zinc-100">
                Forms Collect & Compile
              </span>
              <p className="text-[10px] font-mono text-zinc-500 tracking-wider leading-none mt-0.5">
                SECURE DOCUMENT SYSTEM
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          {user && (
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex flex-col items-end justify-center">
                <div className="flex items-center space-x-1.5">
                  <span className="text-sm font-semibold text-zinc-200">{user.name}</span>
                  <div className="flex items-center space-x-1 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full text-xs font-medium text-zinc-400">
                    {getRoleIcon(user.role)}
                    <span className="font-sans ml-1 text-[11px]">{user.role}</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-500 font-mono mt-0.5">{user.email}</span>
              </div>

              {/* Initials Badge */}
              <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-200 font-bold text-sm flex items-center justify-center font-mono shadow-inner">
                {user.initials}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-950/25 border border-zinc-800 hover:border-rose-900/50 transition-colors cursor-pointer"
                id="btn-logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
