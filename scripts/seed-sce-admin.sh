#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Convex deploy keys override --deployment-name. Reject a key for any other target.
case "${CONVEX_DEPLOY_KEY:-}" in
  ""|prod:determined-cricket-426\|*) ;;
  *) echo "Refusing to seed: CONVEX_DEPLOY_KEY targets a different deployment." >&2; exit 2 ;;
esac

case "${1:---dry-run}" in
  --dry-run) dry_run=true; grant=true ;;
  --apply) dry_run=false; grant=true ;;
  --revoke) dry_run=false; grant=false ;;
  *) echo "Usage: $0 [--dry-run|--apply|--revoke]" >&2; exit 2 ;;
esac

# IDs belong to the production SCE Poker group. Keep them out of app logic.
args=$(cat <<JSON
{
  "groupId": "jn732tfbxd1ewz7swzwfk72jg57zs2pt",
  "userId": "k57dj2shasq9p4hhr4s2qje9y57zq2am",
  "expectedOwnerId": "k576r55jgfd1dc81kng2smksph7zscd0",
  "grant": $grant,
  "dryRun": $dry_run
}
JSON
)

pnpm exec convex run \
  --deployment-name determined-cricket-426 \
  group_admins:setAdmin "$args"
