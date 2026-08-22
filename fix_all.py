import re

# 1. Fix Navbar
with open('src/components/Navbar.jsx', 'r') as f:
    nav = f.read()
    
nav_replacement = """  <Link to="/" className="flex items-center space-x-3 group">
   <img 
     src="/logo.svg" 
     alt="Logo" 
     className="mix-blend-multiply h-8 md:h-10 w-auto transition-transform duration-300 group-hover:scale-105"
   />
   <span className="font-sans text-xs tracking-widest uppercase font-semibold text-[#3300FF] text-xl md:text-2xl transition-all duration-300 group-hover:text-[#00D4FF]">
   DotSlash
   </span>
  </Link>"""

nav = re.sub(r'<Link to="/" className="flex items-center space-x-2 group">[\s\S]*?</Link>', nav_replacement, nav)
with open('src/components/Navbar.jsx', 'w') as f:
    f.write(nav)

# 2. Fix Hero
with open('src/components/Hero.jsx', 'r') as f:
    hero = f.read()

hero_replacement = """  <div className="z-10 text-center pointer-events-none flex flex-col items-center">
          <div className="flex justify-center w-full mb-4">
            <img 
              src="/logo.svg" 
              alt="Logo" 
              style={{ mixBlendMode: 'darken' }}
              className="h-16 sm:h-24 md:h-32 lg:h-40 w-auto"
            />
          </div>
          <h1 className="hero-text text-[10vw] md:text-9xl font-headline-display font-bold leading-none tracking-tighter text-[#030303]">
            DotSlash
          </h1>
          <p className="hero-text font-sans text-xs tracking-widest uppercase font-semibold text-[#030303] mt-4 text-sm md:text-base tracking-widest uppercase">
   ELITE TECH / ARCHITECTING THE VOID
   </p>
  </div>"""

hero = re.sub(r'<div className="z-10 text-center pointer-events-none">[\s\S]*?</p>\n  </div>', hero_replacement, hero)
with open('src/components/Hero.jsx', 'w') as f:
    f.write(hero)

# 3. Fix Footer
with open('src/components/Footer.jsx', 'r') as f:
    footer = f.read()

footer_replacement = """  <div className="col-span-12 flex flex-col items-center justify-center text-center space-y-6">
   <div className="flex items-center justify-center space-x-4">
       <img 
         src="/logo.svg" 
         alt="Logo" 
         className="mix-blend-multiply h-12 md:h-16 w-auto"
       />
       <h2 className="font-headline-display text-5xl md:text-8xl font-black text-[#030303] tracking-tighter">
       DotSlash
       </h2>
   </div>
   <p className="font-sans text-xs tracking-widest uppercase font-semibold text-[#4A5568] text-xs md:text-sm leading-loose">
   © 2024 DotSlash. ALL RIGHTS RESERVED. ENGINEERED FOR EXCELLENCE.
   </p>
  </div>"""

footer = re.sub(r'<div className="col-span-12 flex flex-col items-center justify-center text-center space-y-6">[\s\S]*?</p>\n  </div>', footer_replacement, footer)
with open('src/components/Footer.jsx', 'w') as f:
    f.write(footer)

print("Restored text alongside logo.")
