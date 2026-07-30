#!/usr/bin/env sh
set +e
ROOT="${1:-.}"
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
node "$SCRIPT_DIR/discover-upstream.mjs" "$ROOT"
UPSTREAM=$?
node "$SCRIPT_DIR/audit-original-promotion.mjs" "$ROOT"
AUDIT=$?
printf 'Upstream discovery exit: %s\nPromotion audit exit: %s (1 means matches require review)\n' "$UPSTREAM" "$AUDIT"
exit 0
