#!/bin/sh
# One-time setup of the hosted demo database + Vercel env, then a production deploy.
# Usage: sh scripts/deploy-remote.sh <supabase-project-ref>
# Never prints keys: they are piped straight into the seeder and `vercel env add`.
set -e
REF="$1"
[ -n "$REF" ] || { echo "usage: sh scripts/deploy-remote.sh <project-ref>"; exit 1; }
URL="https://$REF.supabase.co"

echo "1/5 Applying schema..."
npx supabase db query --project-ref "$REF" -f supabase/migrations/20261105000001_lab_schema.sql >/dev/null

echo "2/5 Reading API keys (not printed)..."
KEYS=$(npx supabase projects api-keys --project-ref "$REF" -o json 2>/dev/null)
pick() { printf '%s' "$KEYS" | python3 -c "
import json,sys
d=json.loads(sys.stdin.read()); d=d if isinstance(d,list) else d.get('keys',d)
want=sys.argv[1]
for k in d:
    if k.get('name')==want or (want=='anon' and k.get('type')=='publishable') or (want=='service_role' and k.get('type')=='secret'):
        print(k.get('api_key') or k.get('key')); break
else:
    sys.exit('could not find the '+want+' key')
" "$1"; }
ANON=$(pick anon)
SERVICE=$(pick service_role)

echo "3/5 Seeding sample data..."
NEXT_PUBLIC_SUPABASE_URL="$URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SERVICE" npx tsx scripts/seed.ts

echo "4/5 Setting Vercel env (production)..."
setenv() { vercel env rm "$1" production --yes >/dev/null 2>&1 || true; printf '%s' "$2" | vercel env add "$1" production >/dev/null; echo "  $1 set"; }
setenv NEXT_PUBLIC_SUPABASE_URL "$URL"
setenv NEXT_PUBLIC_SUPABASE_ANON_KEY "$ANON"
setenv SUPABASE_SERVICE_ROLE_KEY "$SERVICE"
setenv LAB_DEMO_LOGIN "1"
setenv LAB_MONTHLY_SPEND_CAP_USD "5"
setenv LAB_DAILY_TOKEN_BUDGET_PER_STUDENT "60000"
AKEY=$(sed -n 's/^ANTHROPIC_API_KEY=//p' .env.local 2>/dev/null | tr -d '"' | head -1)
[ -n "$AKEY" ] && setenv ANTHROPIC_API_KEY "$AKEY" || echo "  ANTHROPIC_API_KEY not found in .env.local: add it in Vercel before using the coach"
unset AKEY

echo "5/5 Deploying..."
vercel deploy --prod --yes
