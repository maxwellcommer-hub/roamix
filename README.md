# Roamix — the public legal pages

The public home of Roamix's legal documents, served by GitHub Pages:

| Page | URL | Why it exists |
|------|-----|----------------|
| Privacy Policy | https://maxwellcommer-hub.github.io/roamix/privacy | **Required** by App Store Connect; goes in the Privacy Policy URL field. |
| Terms of Service | https://maxwellcommer-hub.github.io/roamix/terms | Public copy of the in-app Terms, so they are readable before install. |
| Support | https://maxwellcommer-hub.github.io/roamix/support | **Required** by App Store Connect; goes in the Support URL field. |
| Landing | https://maxwellcommer-hub.github.io/roamix/ | Links the three. |
| Terms of Sale | https://maxwellcommer-hub.github.io/roamix/terms-of-sale | The agreement for buying a printed plaque. |
| Payment received | https://maxwellcommer-hub.github.io/roamix/paid | Stripe's after-payment redirect; hands back to the app. |

### One folder per app version

The pages above are the documents for Roamix 1.0 and 1.1, and they stay exactly as they are.
Roamix **1.2** (the first version that can order a printed plaque) reads its own copies in
`1.2/`, so publishing it changed nothing an earlier version links to:

| Page | URL |
|------|-----|
| Privacy Policy | https://maxwellcommer-hub.github.io/roamix/1.2/privacy |
| Terms of Service | https://maxwellcommer-hub.github.io/roamix/1.2/terms |
| Terms of Sale | https://maxwellcommer-hub.github.io/roamix/1.2/terms-of-sale |
| Support | https://maxwellcommer-hub.github.io/roamix/1.2/support |
| Landing | https://maxwellcommer-hub.github.io/roamix/1.2/ |

A later version that changes the documents gets a folder of its own the same way. `/paid` is
shared: only 1.2 and later can pay, so it has no older copy to protect.

## Keeping the copies in step

The canonical wording lives in the (private) Roamix app source at
`Roamix/Features/You/LegalView.swift` — `LegalLibrary.privacyPolicy` and
`LegalLibrary.terms`. The pages here mirror it **verbatim**, and the app's repo keeps an
identical copy under `docs/` so the two can be diffed:

```
diff -q ~/Roamix/docs/privacy.html ~/roamix-privacy/privacy.html
diff -rq ~/Roamix/docs/1.2 ~/roamix-privacy/1.2
```

Four surfaces have to agree with each other, and a change to any one of them means
checking all four:

1. `LegalView.swift` — the in-app documents
2. these pages
3. `Roamix/Resources/PrivacyInfo.xcprivacy` — the privacy manifest
4. the App Store privacy nutrition labels in App Store Connect ("Data Not Collected",
   Tracking: No)

Bump the effective date in all of them together when the policy materially changes.

`index.html` is now the home page (getroamix.com), built on its own design — `assets/site.css`,
`assets/site.js`, the plates in `assets/panels/` (from the 1.2 store screenshots, headlines masked
out and set as live type) and the atlas `assets/world.svg` (Natural Earth 50m). Every link on it is
relative, so it works on github.io and on the custom domain. `404.html` sends the legal pages'
old absolute `/roamix/…` links to the right place once the domain is on.

`terms.html` and `support.html` are **generated from `privacy.html`'s own
shell** (same head, tokens, header field and footer) so the four pages can never drift
apart visually. Regenerate rather than hand-editing the shared chrome.

## The 1.2 pages share the home page's design

`1.2/*.html` and `paid.html` are rebuilt by `python3 tools/build-legal.py`: it lifts each page's
title, header lines and `<main>` verbatim and wraps them in the shared shell (goo nav, poster
header, reading column with an "On this page" list, the home footer; `assets/legal.css` +
`assets/legal.js` on top of `assets/site.*`). Edit the WORDS inside `<main>` and re-run it.
`python3 tools/build-legal.py --check` proves the visible text matches git HEAD. The 1.0/1.1
pages at the root are frozen and are not rebuilt.

## Licence

The pages and their wording are © 2026 Maxwell Commer — see [LICENSE](LICENSE). The
typefaces in `fonts/` are SIL OFL 1.1 and carry their own licences — see
[fonts/README.md](fonts/README.md).
