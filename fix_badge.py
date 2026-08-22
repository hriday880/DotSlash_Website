import re

# 1. Navbar badge
with open('src/components/Navbar.jsx', 'r') as f:
    nav = f.read()

nav_replacement = """  <Link to="/" className="flex items-center space-x-3 group">
   <div className="bg-white rounded p-1 shadow-sm border border-gray-100 transition-transform duration-300 group-hover:scale-105">
     <img src="/logo.svg" alt="Logo" className="h-6 md:h-8 w-auto" />
   </div>
   <span className="font-sans text-xs tracking-widest uppercase font-semibold text-[#3300FF] text-xl md:text-2xl transition-all duration-300 group-hover:text-[#00D4FF]">
   DotSlash
   </span>
  </Link>"""

nav = re.sub(r'<Link to="/" className="flex items-center space-x-3 group">[\s\S]*?</Link>', nav_replacement, nav)
with open('src/components/Navbar.jsx', 'w') as f:
    f.write(nav)


# 2. Hero badge
with open('src/components/Hero.jsx', 'r') as f:
    hero = f.read()

hero_replacement = """          <div className="flex justify-center w-full mb-8">
            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#E4E4E7]/50">
              <img 
                src="/logo.svg" 
                alt="Logo" 
                className="h-16 sm:h-20 md:h-28 lg:h-32 w-auto"
              />
            </div>
          </div>"""

hero = re.sub(r'<div className="flex justify-center w-full mb-4">[\s\S]*?</div>', hero_replacement, hero)
with open('src/components/Hero.jsx', 'w') as f:
    f.write(hero)

# 3. Footer badge
with open('src/components/Footer.jsx', 'r') as f:
    footer = f.read()

footer_replacement = """   <div className="flex items-center justify-center space-x-4 mb-4">
       <div className="bg-white rounded-xl p-2 shadow-sm border border-gray-100">
         <img src="/logo.svg" alt="Logo" className="h-10 md:h-12 w-auto" />
       </div>
       <h2 className="font-headline-display text-5xl md:text-8xl font-black text-[#030303] tracking-tighter">
       DotSlash
       </h2>
   </div>"""

footer = re.sub(r'<div className="flex items-center justify-center space-x-4">[\s\S]*?</div>', footer_replacement, footer)
with open('src/components/Footer.jsx', 'w') as f:
    f.write(footer)

print("Badged the logo.")
