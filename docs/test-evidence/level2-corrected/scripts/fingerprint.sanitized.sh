#!/bin/zsh
# Read-only fingerprint of everything outside the approved write areas.
R=<repo>
cd "$R" || exit 1
h() { shasum -a 256 "$1" 2>/dev/null | cut -c1-64; }
tree_hash() { find "$1" \( -name node_modules -o -name .next -o -name .open-next -o -name .wrangler -o -name .supabase-home -o -name .git \) -prune -o -type f -print0 | sort -z | xargs -0 shasum -a 256 | shasum -a 256 | cut -c1-64; }
echo "HEAD $(git rev-parse HEAD)"
echo "branches $(git branch --list | wc -l | tr -d ' ')"
echo "git_status $(git status --short | shasum -a 256 | cut -c1-64)"
echo "docs $(tree_hash docs)"
echo "CLAUDE.md $(h CLAUDE.md)"
echo "deploy-test $(tree_hash deploy-test)"
echo "store_tree $(tree_hash store)"
echo "vscode $(tree_hash .vscode)"
for f in store/next-env.d.ts store/package.json store/package-lock.json store/.gitignore store/supabase/config.toml store/supabase/supabase.lock store/supabase/.gitignore; do echo "$f $(h $f)"; done
echo "store_lease_size $(stat -f %z store/supabase/.supabase.lock.lease)"
echo "cache_count $(find store/.supabase-home/cache -type f | wc -l | tr -d ' ')"
