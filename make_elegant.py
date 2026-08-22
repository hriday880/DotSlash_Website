import glob

replacements = {
    # Remove retro text effects
    "glitch-text": "",
    "data-text=\"The Family\"": "",
    "data-text=\"Timeline\"": "",
    "data-text=\"Initialize Connection\"": "",
    "text-glow-blue": "",
    "text-glow-cyan": "",
    "glow-blue": "",
    "glow-cyan": "",
    
    # Replace retro borders with elegant rounded borders
    "pixel-border-cyan": "border border-[#00D4FF] rounded-full",
    "pixel-border": "rounded-2xl border border-[#E4E4E7] shadow-sm hover:shadow-md",
    
    # Replace Mono fonts with elegant Sans (Inter) for labels
    "font-mono font-bold tracking-tight": "font-sans text-xs tracking-widest uppercase font-semibold",
    
    # The glitch-text CSS might have left some artifacts, we just removed the class.
}

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # Extra cleanup for extra spaces
    content = content.replace("  ", " ")
    
    with open(file, 'w') as f:
        f.write(content)
        
print("Updated to elegant aesthetic.")
