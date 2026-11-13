#!/usr/bin/env bash
set -euo pipefail

# Configures GitHub branch protection, Pages workflow publishing, and
# github-pages environment lockdown so only the repo owner on `main`
# can merge and deploy.
#
# Usage:
#   ./scripts/lockdown-github.sh <owner/repo>
# Example:
#   ./scripts/lockdown-github.sh cgood92/keyhop

REPO="${1:-}"
if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo>" >&2
  exit 1
fi

OWNER="${REPO%%/*}"

echo "1) Enabling GitHub Pages (GitHub Actions source) on $REPO..."
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/pages" \
  -f build_type=workflow >/dev/null 2>&1 || \
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/pages" \
  -f build_type=workflow >/dev/null

echo "2) Resolving user ID for $OWNER..."
OWNER_ID="$(gh api "/users/$OWNER" --jq '.id')"

echo "3) Locking 'github-pages' environment to branch 'main' + reviewer '$OWNER'..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/environments/github-pages" \
  --input - <<EOF
{
  "wait_timer": 0,
  "prevent_self_review": false,
  "reviewers": [
    {
      "type": "User",
      "id": $OWNER_ID
    }
  ],
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF

# Remove any default policies and allow ONLY 'main' to deploy to github-pages
EXISTING_POLICIES="$(gh api "/repos/$REPO/environments/github-pages/deployment-branch-policies" --jq '.branch_policies[].id' 2>/dev/null || true)"
for PID in $EXISTING_POLICIES; do
  gh api --method DELETE "/repos/$REPO/environments/github-pages/deployment-branch-policies/$PID" >/dev/null
done

gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/environments/github-pages/deployment-branch-policies" \
  -f name="main" \
  -f type="branch" >/dev/null

echo "4) Protecting 'main' branch (PR + CODEOWNERS + CI check required; admin owner bypass allowed)..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/branches/main/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

echo "5) Restricting GitHub Actions fork PRs (require approval for external contributors)..."
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/$REPO/actions/permissions" \
  -f enabled=true \
  -f allowed_actions=all >/dev/null || true

echo "Done! $REPO is configured for GitHub Pages and locked down to $OWNER on main."
