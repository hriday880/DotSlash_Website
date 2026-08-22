import re

with open('src/components/Hero.jsx', 'r') as f:
    content = f.read()

# Change canvas background to butter yellow / light grey
content = content.replace("ctx.fillStyle = '#030303';", "ctx.fillStyle = '#FFF8E7'; // Butter yellow")

# Remove mix-blend-difference from the text container and text
content = content.replace("mix-blend-difference ", "")
content = content.replace("mix-blend-difference", "")

with open('src/components/Hero.jsx', 'w') as f:
    f.write(content)

print("Fixed Hero.jsx")
