import glob

replacements = {
    "bg-[#FFFFFF]": "bg-[#F3F4F6]",
    "bg-[#FFFFFF]/80": "bg-[#FFF8E7]/80", # Navbar
}

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(file, 'w') as f:
        f.write(content)
        
print("Updated backgrounds to grey/yellow.")
