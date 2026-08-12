#!/bin/zsh
# One-shot publisher for the Roamix privacy policy.
# Run it, complete the GitHub login in the browser when prompted, and it does the rest:
# creates the public repo, pushes, enables GitHub Pages, and waits for the URL to go live.
set -e
cd "$(dirname "$0")"

if ! gh auth status >/dev/null 2>&1; then
  echo "→ Logging in to GitHub (a browser window will open)…"
  gh auth login --hostname github.com --git-protocol https --web
fi

LOGIN=$(gh api user -q .login)
echo "→ Logged in as: $LOGIN"
if [ "$LOGIN" != "maxwellcommer" ]; then
  echo "⚠️  The app expects https://maxwellcommer.github.io/roamix/privacy but your GitHub"
  echo "   username is '$LOGIN'. The page will be at https://$LOGIN.github.io/roamix/privacy —"
  echo "   tell Claude so the URL inside the app and privacy.html can be updated to match."
fi

if ! gh repo view "$LOGIN/roamix" >/dev/null 2>&1; then
  echo "→ Creating public repo $LOGIN/roamix and pushing…"
  gh repo create roamix --public --source . --push \
    --description "Roamix privacy policy (GitHub Pages)"
else
  echo "→ Repo exists; pushing…"
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$LOGIN/roamix.git"
  git push -u origin main
fi

echo "→ Enabling GitHub Pages (main branch, root)…"
gh api -X POST "repos/$LOGIN/roamix/pages" \
  -f 'source[branch]=main' -f 'source[path]=/' >/dev/null 2>&1 \
  || echo "   (Pages already enabled, fine)"

URL="https://$LOGIN.github.io/roamix/privacy"
echo "→ Waiting for $URL to go live (can take a minute)…"
for i in {1..30}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
  if [ "$code" = "200" ]; then
    echo "✅ LIVE: $URL"
    echo "   Set this exact URL as the Privacy Policy URL in App Store Connect."
    exit 0
  fi
  sleep 10
done
echo "⚠️  Not live yet (last status $code). Check https://github.com/$LOGIN/roamix/settings/pages"
