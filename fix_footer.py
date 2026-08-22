import re

with open('src/components/Footer.jsx', 'r') as f:
    footer = f.read()

# Remove the extra h2
footer = re.sub(r'</div>\s*<h2 className="font-headline-display text-5xl md:text-8xl font-black text-\[#030303\] tracking-tighter">\s*DotSlash\s*</h2>', '</div>', footer)

with open('src/components/Footer.jsx', 'w') as f:
    f.write(footer)

print("Fixed footer.")
