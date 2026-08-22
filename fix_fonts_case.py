import glob

replacements = {
    "DOTSLASH": "DotSlash",
    "font-pixel": "font-mono font-bold tracking-tight",
}

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(file, 'w') as f:
        f.write(content)
        
print("Updated fonts and casing.")
