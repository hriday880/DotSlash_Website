import glob
import re

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Remove the style block with the filter
    content = re.sub(r'style=\{\{[\s\S]*?\}\}', '', content)
    
    with open(file, 'w') as f:
        f.write(content)

print("Removed CSS filters.")
