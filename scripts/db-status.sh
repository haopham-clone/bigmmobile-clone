#!/usr/bin/env bash
# Print connection info from running local Supabase stack
set -euo pipefail
supabase status 2>/dev/null || {
  echo "Supabase is not running. Start it with: npm run db:start"
  exit 1
}
