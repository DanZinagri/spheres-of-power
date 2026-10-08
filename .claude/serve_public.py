"""Serve public/ like GitHub Pages does (clean URLs: /Page -> /Page.html) for local testing of
the built site, including the Pagefind search index. Usage: python .claude/serve_public.py [port]"""
import http.server
import os
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "public"
BASE = ""  # the site is published at the domain root (spheresofpower.wiki)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def translate_path(self, path):
        path = urllib.parse.urlsplit(path).path
        if path.startswith(BASE):
            path = path[len(BASE):] or "/"
        full = Path(super().translate_path(path))
        if not full.exists() and full.with_name(full.name + ".html").exists():
            return str(full.with_name(full.name + ".html"))
        return str(full)


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
os.chdir(ROOT)
http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
