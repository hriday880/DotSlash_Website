import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('dotslash_admin_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const correctPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    
    if (password === correctPassword) {
      localStorage.setItem('dotslash_admin_auth', 'true');
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
