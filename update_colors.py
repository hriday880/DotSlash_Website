import os
import glob

replacements = {
    "bg-[#030303]": "bg-[#FFFFFF]",
    "bg-[#131313]": "bg-[#F4F4F5]",
    "bg-[#0a0a0a]": "bg-[#F4F4F5]",
    "bg-[#1b1b1b]": "bg-[#F4F4F5]",
    "text-white": "text-[#030303]",
    "border-[#1A1A1A]": "border-[#E4E4E7]",
    "border-white/5": "border-black/5",
    "border-white/10": "border-black/10",
    "border-white/20": "border-black/20",
    "text-[#A0A0A0]": "text-[#52525B]",
    "text-[#c4c7c8]": "text-[#52525B]",
    "bg-[#FFFFFF] animate-pulse": "bg-[#030303] animate-pulse",
    "mix-blend-screen": "mix-blend-multiply",
    "text-[#030303] mix-blend-difference": "text-[#030303]",
    "bg-[#030303]/80": "bg-[#FFFFFF]/80",
    "bg-white": "bg-[#030303]"
}

files = glob.glob("src/**/*.jsx", recursive=True) + glob.glob("src/**/*.css", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        if old == "bg-white" and "bg-white" in content:
            # We skip this general replace here to avoid conflict with the first one
            continue
        content = content.replace(old, new)
        
    with open(file, 'w') as f:
        f.write(content)
        
print("Updated all files.")
