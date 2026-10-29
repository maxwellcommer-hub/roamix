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
    <div class="cta"><a href="{APP}" aria-label="Get Roamix on the App Store"><span class="long">Get the app</span><span class="short">Get</span></a></div>
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
    <nav class="social" aria-label="Roamix on social media">
      <a href="https://www.instagram.com/getroamix/" rel="me noopener" aria-label="Roamix on Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg></a>
      <a href="https://www.tiktok.com/@getroamix" rel="me noopener" aria-label="Roamix on TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>
      <a href="https://www.youtube.com/@getroamix" rel="me noopener" aria-label="Roamix on YouTube"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
      <a href="https://x.com/getroamix" rel="me noopener" aria-label="Roamix on X"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg></a>
      <a href="https://www.threads.com/@getroamix" rel="me noopener" aria-label="Roamix on Threads"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"/></svg></a>
      <a href="https://www.facebook.com/getroamix" rel="me noopener" aria-label="Roamix on Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a>
    </nav>
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
