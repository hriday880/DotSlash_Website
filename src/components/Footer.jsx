import React from 'react';

const Footer = () => {
 return (
 <footer className="bg-[#F3F4F6] border-t border-[#3300FF]/20 py-12 px-6 md:px-12 relative overflow-hidden">
  <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6 relative z-10">
    <div className="col-span-12 flex flex-col items-center justify-center text-center space-y-6">
         <div className="flex items-center justify-center space-x-6 mb-6">
       <img src="/logo.svg" alt="Logo" className="mix-blend-multiply h-12 md:h-16 w-auto" />
       <h2 className="font-headline-display text-5xl md:text-8xl font-black text-[#030303] tracking-tighter">
       DotSlash
       </h2>
   </div>
       <h2 className="font-headline-display text-5xl md:text-8xl font-black text-[#030303] tracking-tighter">
       DotSlash
       </h2>
   </div>
   <p className="font-sans text-xs tracking-widest uppercase font-semibold text-[#4A5568] text-xs md:text-sm leading-loose">
   © 2024 DotSlash. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.
   </p>
  </div>
  </div>
 </footer>
 );
};

export default Footer;
