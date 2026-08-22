import React from 'react';

const Footer = () => {
 return (
 <footer className="bg-[#F3F4F6] border-t border-[#3300FF]/20 py-12 px-6 md:px-12 relative overflow-hidden">
  <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 relative z-10">
  <div className="col-span-12 flex flex-col items-center justify-center text-center space-y-6">
   <img 
     src="/logo.svg" 
     alt="DotSlash" 
     className="h-16 md:h-24 w-auto mb-4"
     style={{
       filter: 'brightness(0) saturate(100%) invert(13%) sepia(91%) saturate(7460%) hue-rotate(264deg) brightness(101%) contrast(124%)'
     }}
   />
   <p className="font-sans text-xs tracking-widest uppercase font-semibold text-[#4A5568] text-xs md:text-sm leading-loose">
   © 2024 DotSlash. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.
   </p>
  </div>
  </div>
 </footer>
 );
};

export default Footer;
