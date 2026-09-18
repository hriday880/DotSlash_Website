import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('dotslash_admin_auth');
    if (auth === 'superadmin' || auth === 'blogadmin' || auth === 'announcementadmin' || auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  async function hashPassword(pw) {
    const msgUint8 = new TextEncoder().encode(pw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    const inputHash = await hashPassword(password);
    
    const masterHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH;
    const blogHash = import.meta.env.VITE_BLOG_PASSWORD_HASH;
    const annHash = import.meta.env.VITE_ANNOUNCEMENT_PASSWORD_HASH;
    
    if (inputHash === masterHash) {
      localStorage.setItem('dotslash_admin_auth', 'superadmin');
      setIsAuthenticated(true);
    } else if (blogHash && inputHash === blogHash) {
      localStorage.setItem('dotslash_admin_auth', 'blogadmin');
      setIsAuthenticated(true);
    } else if (annHash && inputHash === annHash) {
      localStorage.setItem('dotslash_admin_auth', 'announcementadmin');
      setIsAuthenticated(true);
    } else {
      setError('Invalid sequence.');
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <Navigate to="/admin" />;
  }

  return (
    <div className="min-h-screen bg-[#030303] text-[#FFFFFF] flex items-center justify-center p-4 pt-32">
      <div className="max-w-md w-full bg-[#131313] border border-[#353535] p-8 text-center flex flex-col items-center">
        <div className="w-16 h-16 bg-[#3300FF]/20 text-[#3300FF] rounded-full flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        <h1 className="font-headline-md text-[32px] text-[#3300FF] mb-2 uppercase">Admin Portal</h1>
        <p className="text-[#A0A0A0] font-mono text-sm mb-8">
          Restricted access. Enter clearance code.
        </p>
        
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ACCESS CODE"
            className="w-full bg-[#030303] border border-[#353535] p-4 text-center text-white font-mono tracking-widest focus:border-[#3300FF] outline-none transition-colors"
          />
          {error && <p className="text-red-500 font-mono text-xs">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-[#3300FF] hover:bg-[#00D4FF] text-white font-bold py-4 px-6 uppercase tracking-widest transition-colors duration-300"
          >
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
