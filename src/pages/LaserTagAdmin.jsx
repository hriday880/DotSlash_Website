import React from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import {
  ExternalLink,
  LogOut,
  ArrowLeft,
} from 'lucide-react';
import LaserTagAdminSection from '../components/LaserTagAdminSection';

export default function LaserTagAdmin() {
  const navigate = useNavigate();

  // Check auth
  const role = localStorage.getItem('dotslash_admin_auth');
  if (!role) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('dotslash_admin_auth');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#030303] text-white selection:bg-[#3300FF] selection:text-white pb-32">
      {/* Top Header */}
      <header className="border-b border-[#252525] bg-[#0c0c0c]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="p-2 bg-[#141414] border border-[#353535] hover:border-[#3300FF] text-[#A0A0A0] hover:text-white transition-colors"
              title="Return to Main Command Center"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-xs tracking-widest uppercase font-semibold text-[#00D4FF]">
                  DotSlash Command Portal
                </span>
                <span className="px-1.5 py-0.2 bg-[#3300FF]/30 border border-[#3300FF] text-[10px] font-mono text-[#00D4FF]">
                  LASER TAG VERIFICATION
                </span>
              </div>
              <h1 className="text-xl font-bold font-headline-md tracking-tight uppercase text-white">
                Screenshot Verification & Email Dispatch Queue
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/laser-tag"
              target="_blank"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-[#151515] hover:bg-[#202020] border border-[#353535] text-xs font-mono text-[#A0A0A0] hover:text-white transition-colors"
            >
              <ExternalLink size={13} />
              <span>Public Arena</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 bg-red-950/30 border border-red-800/40 hover:bg-red-900/40 text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <LaserTagAdminSection />
      </main>
    </div>
  );
}
