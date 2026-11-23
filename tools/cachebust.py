"""Stamp every site file reference with a version so a deploy never mixes with cached old files.

Usage: python3 tools/cachebust.py <site_dir> <version>
Rewrites, in place: relative ES-module imports in .js/.html ('./x.js' -> './x.js?v=VER'),
and href/src of local .css/.js in .html. Run on the deploy copy only (CI), not on the repo.
"""
import pathlib
import re
import sys

site, ver = pathlib.Path(sys.argv[1]), sys.argv[2]
imp = re.compile(r"""((?:\bfrom|\bimport)\s*\(?\s*['"])(\.{1,2}/[^'"?]+\.js)(['"])""")
tag = re.compile(r"""((?:href|src)=")((?!https?:|data:|//)[^"?#]+\.(?:css|js))(")""")
n = 0
for p in list(site.rglob('*.js')) + list(site.rglob('*.html')):
    if 'vendor' in p.parts:
        continue
    s = p.read_text(encoding='utf-8')
    t = imp.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
    if p.suffix == '.html':
        t = tag.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", t)
    if t != s:
        p.write_text(t, encoding='utf-8')
        n += 1
print(f'cache-busted {n} files with v={ver}')
