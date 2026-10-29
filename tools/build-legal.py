#!/usr/bin/env python3
"""Rebuild the 1.2 documents and /paid in the home page's design.

The WORDS are never touched. From each page this lifts, verbatim: the <title>, the header's
kicker / <h1> / effective line, and everything inside <main>. It then wraps them in the shared
shell (goo nav, poster header, reading column with a table of contents, the home footer).
It is idempotent: it reads the same markers from a page it has already built.

The only markup change inside <main>: absolute /roamix/1.2/... links become relative, because
the site now lives at the root of getroamix.com (they would otherwise bounce through 404.html).

The 1.0/1.1 documents at the root (privacy, terms, terms-of-sale, support) are frozen and are
NOT rebuilt — owner's decision, 2026-10-29.

    python3 tools/build-legal.py            # rebuild, then prove the text is unchanged:
    python3 tools/build-legal.py --check    # compare visible text against git HEAD
"""
import re, sys, html, subprocess, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = {  # page: (path prefix to the site root, nav link marked current)
    "1.2/index.html": ("../", None),
    "1.2/privacy.html": ("../", "privacy"),
    "1.2/terms.html": ("../", None),
    "1.2/terms-of-sale.html": ("../", None),
    "1.2/support.html": ("../", None),
    "paid.html": ("", None),
}
APP = "https://apps.apple.com/us/app/roamix/id6794683260"


def grab(pattern, s, flags=re.S):
    m = re.search(pattern, s, flags)
    if not m:
        raise SystemExit(f"marker not found: {pattern[:60]}")
    return m.group(1)


def parts(src):
    head_comment = grab(r"<!doctype html>\s*(<!--.*?-->)", src)
    return {
        "comment": head_comment,
        "title": grab(r"<title>(.*?)</title>", src),
        "icon": grab(r'(<link rel="icon"[^>]*>)', src),
        "wm": grab(r'<g id="wm">(.*?)</g>\s*(?:</svg>|</defs>)', src),
        "kicker": grab(r'<p class="kicker">(.*?)</p>', src),
        "h1": grab(r"<h1>(.*?)</h1>", src),
        "effective": grab(r'<p class="effective">(.*?)</p>', src),
        "main": grab(r"<main[^>]*>(.*?)</main>", src),
    }


def visible_text(src):
    """The words a reader sees: header kicker/title/effective line + the document body."""
    p = parts(src)
    t = " ".join([p["kicker"], p["h1"], p["effective"], p["main"]])
    t = re.sub(r"<script.*?</script>", " ", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def shell(p, base, current):
    main = p["main"].replace('href="/roamix/1.2/', 'href="' + ("" if base == "../" else "1.2/"))
    comment = re.sub(r"  The DESIGN is.*?(?=-->)",
                     "  The DESIGN is the home page's (assets/site.css + assets/legal.css), applied by\n"
                     "  tools/build-legal.py, which lifts the words above verbatim — edit the WORDS here and\n"
                     "  re-run it; never edit the shared chrome by hand.\n", p["comment"], flags=re.S)
    privacy = "privacy" if base == "../" else "1.2/privacy"
    doc = lambda name: (name if base == "../" else "1.2/" + name)
    cur = lambda key: ' aria-current="page"' if current == key else ""
    return f"""<!doctype html>
{comment}
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#E8401E">
<title>{p["title"]}</title>
{p["icon"]}
<link rel="preload" href="{base}fonts/BricolageGrotesque-ExtraBold.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="{base}assets/site.css">
<link rel="stylesheet" href="{base}assets/legal.css">
</head>
<body class="legal">

<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="wm">{p["wm"]}</g></defs></svg>

<nav class="nav" id="nav" aria-label="Main">
  <canvas class="goo" aria-hidden="true"></canvas>
  <div class="row">
    <a class="brand" href="{base or './'}" aria-label="Roamix home"><svg viewBox="0 0 247.43 108.6" aria-hidden="true"><use href="#wm"/></svg></a>
    <div class="links">
      <span class="pick" aria-hidden="true"></span>
      <a href="{base}#tour">Tour</a>
      <a href="{base}#fills">How</a>
      <a href="{privacy}"{cur("privacy")}>Privacy</a>
      <a href="{base}#plaque">Plaque</a>
    </div>
    <div class="cta"><a href="{APP}">Get the app</a></div>
  </div>
</nav>

<header class="doc-head" data-tint="#E8401E">
  <img class="map" src="{base}assets/world.svg" alt="" width="2000" height="1173">
  <div class="inner">
    <p class="kicker">{p["kicker"]}</p>
    <h1>{p["h1"]}</h1>
    <p class="effective">{p["effective"]}</p>
  </div>
</header>

<div class="doc-wrap" data-tint="#F7F4ED">
  <aside class="toc" aria-label="On this page"><p class="mono">On this page</p><ol id="toc"></ol></aside>
  <main class="doc" id="doc">{main}</main>
</div>

<footer class="foot" data-tint="#16150F">
  <div class="inner">
    <svg class="wm" viewBox="0 0 247.43 108.6" aria-hidden="true"><use href="#wm"/></svg>
    <div class="cols">
      <div><h4>App</h4><a href="{APP}">App Store</a><a href="{base}#tour">Tour</a><a href="{base}#plaque">Plaques</a></div>
      <div><h4>Help</h4><a href="{doc('support')}">Support</a><a href="mailto:roamix@maxwellcommer.com">Email us</a></div>
      <div><h4>Legal</h4><a href="{doc('privacy')}">Privacy Policy</a><a href="{doc('terms')}">Terms of Service</a><a href="{doc('terms-of-sale')}">Terms of Sale</a></div>
      <div><h4>Earlier versions</h4><a href="{base}privacy">Privacy (1.0–1.1)</a><a href="{base}terms">Terms (1.0–1.1)</a></div>
    </div>
    <p class="legal">© 2026 Maxwell Commer. Roamix is an independent app made by one person. Apple, iPhone, iCloud and App Store are trademarks of Apple Inc. Type set in Bricolage Grotesque, Schibsted Grotesk &amp; Martian Mono — SIL OFL 1.1.</p>
  </div>
</footer>

<script src="{base}assets/site.js" defer></script>
<script src="{base}assets/legal.js" defer></script>
</body>
</html>
"""


def main():
    check = "--check" in sys.argv
    bad = 0
    for page, (base, current) in PAGES.items():
        path = ROOT / page
        src = path.read_text()
        if not check:
            path.write_text(shell(parts(src), base, current))
        before = subprocess.run(["git", "-C", str(ROOT), "show", f"HEAD:{page}"], capture_output=True, text=True).stdout
        same = visible_text(before) == visible_text(path.read_text())
        bad += not same
        print(("same words  " if same else "WORDS DIFFER ") + page)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
