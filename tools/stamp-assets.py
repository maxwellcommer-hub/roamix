#!/usr/bin/env python3
"""Tag every link to assets/*.css|js with a hash of the file's contents (?v=1a2b3c4d).

GitHub Pages serves files with a 10-minute cache, so after a deploy a browser could pair a
new page with yesterday's script. With the content hash in the URL, a changed file is a new
URL and is fetched fresh; an unchanged one stays cached. Run before every push (after
build-legal.py, which writes the legal pages' links).

    python3 tools/stamp-assets.py
"""
import hashlib, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = ["index.html", "paid.html", "404.html", *sorted(str(p.relative_to(ROOT)) for p in (ROOT / "1.2").glob("*.html"))]

def digest(name):
    return hashlib.sha1((ROOT / "assets" / name).read_bytes()).hexdigest()[:8]

for page in PAGES:
    path = ROOT / page
    s = path.read_text()
    new = re.sub(r'(assets/((?:site|legal|plaque)\.(?:css|js)))(\?v=[0-9a-f]+)?"',
                 lambda m: f'{m.group(1)}?v={digest(m.group(2))}"', s)
    if new != s:
        path.write_text(new)
        print("stamped", page)
