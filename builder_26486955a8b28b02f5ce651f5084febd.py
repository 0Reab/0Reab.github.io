import markdown2
import re
import shutil
from pathlib import Path

base = "base.html"

with open(base, 'r', encoding='utf-8') as f:
    base_html = f.read()

def insert_content(base, content):
    return re.sub(
        r'(<!-- content start -->).*?(<!-- content end -->)',
        lambda m: f'{m.group(1)}\n{content}\n{m.group(2)}',
        base,
        flags=re.DOTALL
    )

def filename_to_title(filename):
    name = Path(filename).stem
    return name.replace('_', ' ').replace('-', ' ').title()

md_files = {}
for path in Path('markdown').rglob('*.md'):
    relative = path.as_posix()
    with open(path, 'r', encoding='utf-8') as f:
        md_files[relative] = f.read()

html_files = {}
for relative_path, md_text in md_files.items():
    html_output = markdown2.markdown(md_text, extras=["fenced-code-blocks", "highlightjs-lang", "code-friendly"])
    full_html = insert_content(base_html, html_output)
    out_path = Path(relative_path).with_suffix('.html')
    parts = list(out_path.parts)
    parts[0] = 'html'
    html_files[Path(*parts).as_posix()] = full_html

for out_path, content in html_files.items():
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {out_path}")

subdirs = {}
for out_path in html_files:
    parts = Path(out_path).parts
    if len(parts) == 3:
        subdir = parts[1]
        if subdir not in subdirs:
            subdirs[subdir] = []
        subdirs[subdir].append(parts[2])
    elif len(parts) == 2:
        pass

for subdir, files in subdirs.items():
    category = subdir.capitalize()
    rows = ''
    for filename in sorted(files):
        title = filename_to_title(filename)
        rows += f'''        <tr>
            <td><a class="index-link" href="{filename}">{title}</a></td>
        </tr>\n'''
 
    table_html = f'''<h1 class="category-title">{category}</h1>
<table class="index-table">
    <tbody>
{rows}    </tbody>
</table>
<style>
    .index-table {{ width: 100%; border-collapse: collapse;}}
    .index-table tr {{ border-bottom: 1px solid #3e5749; transition: background 0.2s ease; }}
    .index-table tr:hover {{background-color: rgba(255,255,255,0.03);}}
    .index-link:hover {{color: yellowgreen;}}
    .index-link {{
        display: block;
        padding: 1rem 0.5rem;
        font-size: 1.2rem;
        color: yellowgreen;
        text-decoration: none;
        letter-spacing: 0.03em;
    }}
</style>'''
    full_index = insert_content(base_html, table_html)
 
    index_path = Path('html') / subdir / 'index.html'
    index_path.parent.mkdir(parents=True, exist_ok=True)
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(full_index)
    print(f"Written index: {index_path}")

shutil.copy("html/about.html", 'index.html')

print("Done.")