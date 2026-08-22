import glob

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    content = content.replace("pixel-grid-bg", "")
    content = content.replace("  ", " ")
        
    with open(file, 'w') as f:
        f.write(content)
        
print("Removed pixel grid bg.")
