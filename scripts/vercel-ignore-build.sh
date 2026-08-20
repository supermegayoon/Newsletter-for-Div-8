#!/bin/bash
set -e

if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "[Vercel] No parent commit available -> build."
  exit 1
fi

CHANGED="$(git diff --name-only HEAD^ HEAD)"
echo "[Vercel] Changed files:"
echo "$CHANGED"

if [ -z "$CHANGED" ]; then
  echo "[Vercel] No changes -> skip."
  exit 0
fi

while IFS= read -r file; do
  [ -z "$file" ] && continue
  case "$file" in
    market-current.json|news-current.json|ai-current.json|competitor-current.json|publication-current.json|tariff-current.json|raw-materials.json)
      ;;
    archive/*|manual-refresh/*|*.md)
      ;;
    *)
      echo "[Vercel] Code/config change detected: $file -> BUILD."
      exit 1
      ;;
  esac
done <<< "$CHANGED"

echo "[Vercel] Data/archive-only commit -> SKIP deployment."
exit 0
