import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
 const [isOpen, setIsOpen] = useState(false);
 const location = useLocation();

  const links = [
  { name: 'Home', path: '/' },
  { name: 'Laser Tag', path: '/laser-tag', highlight: true },
  { name: 'Events', path: '/events' },
  { name: 'Team', path: '/team' },
  { name: 'Blog', path: '/blog' },
  { name: 'Contact', path: '/contact' }
  ];

 const toggleMenu = () => setIsOpen(!isOpen);

 return (
 <nav className="fixed top-0 w-full z-50 backdrop-blur-xl border-b border-[#E4E4E7] bg-[#F3F4F6]/80 transition-all duration-300">
  <div className="max-w-7xl mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
  {/* Logo */}
        <Link to="/" className="flex items-center space-x-3 group">
   <img src="/logo.svg" alt="Logo" className="mix-blend-multiply h-8 md:h-10 w-auto transition-transform duration-300 group-hover:scale-105" />
   <span className="font-sans text-xs tracking-widest uppercase font-semibold text-[#3300FF] text-xl md:text-2xl transition-all duration-300 group-hover:text-[#00D4FF]">
   DotSlash
   </span>
  </Link>

  {/* Desktop Nav */}
  <div className="hidden md:flex items-center space-x-8">
   {links.map((link) => (
   <Link
    key={link.name}
    to={link.path}
    className={`font-label-caps text-sm tracking-widest uppercase transition-colors duration-300 ${
    link.highlight
      ? location.pathname === link.path
        ? 'px-3 py-1 bg-[#3300FF] text-white font-bold rounded-sm shadow-[0_0_10px_rgba(51,0,255,0.5)]'
        : 'px-3 py-1 bg-[#3300FF]/15 text-[#3300FF] hover:bg-[#3300FF] hover:text-white font-bold border border-[#3300FF]/30 rounded-sm'
      : location.pathname === link.path
      ? 'text-[#3300FF] font-bold'
      : 'text-[#52525B] hover:text-[#00D4FF]'
    }`}
   >
    {link.name}
   </Link>
   ))}
  </div>

  {/* Mobile Toggle */}
  <button
   className="md:hidden text-[#030303] hover:text-[#3300FF] transition-colors"
   onClick={toggleMenu}
  >
   {isOpen ? <X size={28} /> : <Menu size={28} />}
  </button>
  </div>

  {/* Mobile Nav */}
  {isOpen && (
  <div className="md:hidden absolute top-20 left-0 w-full bg-[#F4F4F5] border-b border-[#E4E4E7] py-6 px-6 flex flex-col space-y-6">
   {links.map((link) => (
   <Link
    key={link.name}
    to={link.path}
    onClick={() => setIsOpen(false)}
    className={`font-label-caps text-lg tracking-widest uppercase transition-colors duration-300 ${
    link.highlight
      ? location.pathname === link.path
        ? 'text-[#3300FF] font-bold underline'
        : 'text-[#3300FF] font-semibold flex items-center justify-between'
      : location.pathname === link.path
      ? 'text-[#3300FF] font-bold'
      : 'text-[#52525B] hover:text-[#00D4FF]'
    }`}
   >
    <span>{link.name}</span>
    {link.highlight && <span className="text-[10px] bg-[#3300FF] text-white px-2 py-0.5 rounded-sm">OCT 22</span>}
   </Link>
   ))}
  </div>
  )}
 </nav>
 );
};

export default Navbar;
