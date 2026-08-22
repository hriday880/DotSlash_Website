import glob
import re

files = glob.glob("src/**/*.jsx", recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # Find img tags that reference logo.svg and add mix-blend-multiply to their className
    # e.g. className="h-10 md:h-12 w-auto transition-transform duration-300 group-hover:scale-105"
    # -> className="mix-blend-multiply h-10 md:h-12 w-auto transition-transform duration-300 group-hover:scale-105"
    
    def replacer(match):
        img_tag = match.group(0)
        if 'className="' in img_tag and 'mix-blend-multiply' not in img_tag:
            return img_tag.replace('className="', 'className="mix-blend-multiply ')
        return img_tag
        
    content = re.sub(r'<img[^>]*src="/logo\.svg"[^>]*>', replacer, content)
    
    with open(file, 'w') as f:
        f.write(content)

print("Added mix-blend-multiply.")
