# Roamix — the public legal pages

The public home of Roamix's legal documents, served by GitHub Pages:

| Page | URL | Why it exists |
|------|-----|----------------|
| Privacy Policy | https://maxwellcommer-hub.github.io/roamix/privacy | **Required** by App Store Connect; goes in the Privacy Policy URL field. |
| Terms of Service | https://maxwellcommer-hub.github.io/roamix/terms | Public copy of the in-app Terms, so they are readable before install. |
| Support | https://maxwellcommer-hub.github.io/roamix/support | **Required** by App Store Connect; goes in the Support URL field. |
| Landing | https://maxwellcommer-hub.github.io/roamix/ | Links the three. |

## Keeping the copies in step

The canonical wording lives in the (private) Roamix app source at
`Roamix/Features/You/LegalView.swift` — `LegalLibrary.privacyPolicy` and
`LegalLibrary.terms`. The pages here mirror it **verbatim**, and the app's repo keeps an
identical copy under `docs/` so the two can be diffed:

```
diff -q ~/Roamix/docs/privacy.html ~/roamix-privacy/privacy.html
```

Four surfaces have to agree with each other, and a change to any one of them means
checking all four:

1. `LegalView.swift` — the in-app documents
2. these pages
3. `Roamix/Resources/PrivacyInfo.xcprivacy` — the privacy manifest
4. the App Store privacy nutrition labels in App Store Connect ("Data Not Collected",
   Tracking: No)

Bump the effective date in all of them together when the policy materially changes.

`terms.html`, `support.html` and `index.html` are **generated from `privacy.html`'s own
shell** (same head, tokens, header field and footer) so the four pages can never drift
apart visually. Regenerate rather than hand-editing the shared chrome.

## Licence

The pages and their wording are © 2026 Maxwell Commer — see [LICENSE](LICENSE). The
typefaces in `fonts/` are SIL OFL 1.1 and carry their own licences — see
[fonts/README.md](fonts/README.md).
