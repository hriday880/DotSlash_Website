import re

with open('src/App.jsx', 'r') as f:
    app = f.read()

# Remove CustomCursor import
app = re.sub(r"import CustomCursor from '\./components/CustomCursor';\n?", "", app)

# Remove CustomCursor component
app = re.sub(r"\s*<CustomCursor />\n?", "", app)

with open('src/App.jsx', 'w') as f:
    f.write(app)

with open('src/index.css', 'r') as f:
    css = f.read()

# Remove cursor: none
css = re.sub(r"\s*cursor:\s*none;\n?", "\n", css)

with open('src/index.css', 'w') as f:
    f.write(css)

print("Removed custom cursor.")
