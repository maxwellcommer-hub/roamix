# Roamix — getroamix.com

The website for [Roamix](https://apps.apple.com/us/app/roamix/id6794683260), served by GitHub Pages.

| Page | URL |
|------|-----|
| Home | https://getroamix.com/ |
| Privacy Policy | https://getroamix.com/privacy |
| Terms of Service | https://getroamix.com/terms |
| Terms of Sale | https://getroamix.com/terms-of-sale |
| Support | https://getroamix.com/support |

Roamix 1.2 and later read their own copies of the documents in [`1.2/`](1.2/). The pages at the
root are the documents for 1.0 and 1.1 and are not changed.

## Building

```
python3 tools/build-legal.py     # rebuild 1.2/*.html and paid.html around their <main>
python3 tools/stamp-assets.py    # tag asset links with a content hash; run before every push
```

## Licence

The pages and their wording are © 2026 Maxwell Commer — see [LICENSE](LICENSE). The typefaces in
`fonts/` are SIL OFL 1.1 and carry their own licences — see [fonts/README.md](fonts/README.md).
