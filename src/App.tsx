import React, { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from './lib/firebaseClient';
import { UserProfile, UserRole } from './types';
import { Loader2, ShieldAlert, FileText, Settings, Users, Eye, Database } from 'lucide-react';

// Import components
import Navbar from './components/Navbar';
import LoginView from './components/LoginView';
import AdminDashboard from './components/AdminDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import ProfileInitialization from './components/ProfileInitialization';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // For Admins, allow switching views to test Employee and Manager perspectives
  const [adminActiveTab, setAdminActiveTab] = useState<UserRole>('Admin');

  useEffect(() => {
    // Listen for Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        try {
          // Fetch additional profile data from Firestore
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setUser(profile);
            
            // Set initial tab for Admins
            if (profile.role === 'Admin') {
              setAdminActiveTab('Admin');
            }
          } else {
            console.error('No matching Firestore user profile document found.');
            setUser(null);
            await signOut(auth);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUser(null);
          await signOut(auth);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  const handleLoginSuccess = (profile: UserProfile) => {
    setUser(profile);
    if (profile.role === 'Admin') {
      setAdminActiveTab('Admin');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center space-y-4">
        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 shadow-xl flex flex-col items-center space-y-3 backdrop-blur-xs">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <div className="text-center">
            <span className="text-sm font-bold text-zinc-100 block font-sans">Securing Connection...</span>
            <span className="text-xs text-zinc-500 block mt-0.5 font-mono">Forms Collect & Compile Gateway</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col text-zinc-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation bar */}
      <Navbar user={user} onLogout={handleLogout} />

      {/* Main workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user ? (
          <LoginView onLoginSuccess={handleLoginSuccess} />
        ) : !user.initialsConfirmed ? (
          <ProfileInitialization user={user} onSuccess={handleLoginSuccess} />
        ) : (
          <div className="space-y-6">
            
            {/* Admin Perspective Control Selector */}
            {user.role === 'Admin' && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-zinc-300 backdrop-blur-xs animate-fade-in">
                <div className="flex items-center space-x-2">
                  <Settings className="w-4.5 h-4.5 text-indigo-500" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">
                    Admin Sandbox Controls:
                  </span>
                </div>
                
                <div className="flex bg-zinc-950 border border-zinc-800/80 p-1 rounded-xl">
                  <button
                    onClick={() => setAdminActiveTab('Admin')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                      adminActiveTab === 'Admin'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    <span>Admin Controls</span>
                  </button>
                  <button
                    onClick={() => setAdminActiveTab('Manager')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                      adminActiveTab === 'Manager'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Manager View</span>
                  </button>
                  <button
                    onClick={() => setAdminActiveTab('Employee')}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                      adminActiveTab === 'Employee'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Employee View</span>
                  </button>
                </div>
              </div>
            )}

            {/* Core Dashboard Router */}
            <div>
              {user.role === 'Admin' ? (
                adminActiveTab === 'Admin' ? (
                  <AdminDashboard currentUser={user} />
                ) : adminActiveTab === 'Manager' ? (
                  <ManagerDashboard user={user} />
                ) : (
                  <EmployeeDashboard user={user} />
                )
              ) : user.role === 'Manager' ? (
                <ManagerDashboard user={user} />
              ) : (
                <EmployeeDashboard user={user} />
              )}
            </div>
            
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#09090b]/50 border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 font-mono mt-auto">
        <p>© 2026 Forms Collect & Compile. Secured via Firebase Authentication & Cloud Firestore.</p>
      </footer>
    </div>
  );
}
