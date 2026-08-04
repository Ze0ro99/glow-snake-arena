PR Runbook — mainnet → main

This runbook describes the exact checks, steps, and post-merge verification required before merging the `mainnet -> main` PR that enables Pi mainnet integration and publishes the Pidex token manifest.

Pre-merge checklist (must be completed BEFORE merging)

1. Secrets in Lovable (publish to live app)
   - SESSION_SECRET
   - PI_NETWORK_API_KEY or PI_NETWORK_API_KEY_ACTIVE (mainnet server API key)
   - PI_API_KEY_MAINNET (if separate)
   - PI_APP_WALLET_SEED_MAINNET (if using server A2U payouts on mainnet)
   - PI_WALLET_ADDRESS_MAINNET
   - VITE_CIDI_API_KEY
   - VITE_CIDI_BASE_URL (optional)
   - SUPABASE_URL and SUPABASE_SERVICE_KEY (if using Supabase admin client)
   - Ensure each secret is published (Lovable requires an explicit "Publish" step to make secrets available to live deployments).

2. Validation key
   - The repository contains a placeholder at public/validation-key.mainnet.txt; do NOT replace this file in Git with the real key.
   - Upload the real mainnet validation-key.txt to your production host so it is served at:
     https://<your-production-domain>/validation-key.txt
   - Confirm the file is reachable via HTTPS.

3. Pidex publish credentials (optional)
   - If you want the repo workflow to publish the Pidex package, set repository secrets:
     - PIDEX_UPLOAD_URL
     - PIDEX_API_TOKEN
   - If you prefer to publish manually, skip this; the pidex/manifest.json and media files are committed to branch `mainnet`.

Merge procedure

1. Confirm all pre-merge checklist items are done and documented in this PR.
2. Merge the PR using the GitHub UI or gh CLI (prefer Merge commit).
   - gh pr merge 2 --merge --delete-branch
3. Deploy your `main` branch to production using Lovable's deploy/publish UI (ensure secrets are included in this publish).

Post-merge verification (manual smoke tests)

1. CiDi checks (main deployment)
   - Open: https://<your-app>/?tempToken=<token>  (platform supplies tempToken)
   - Verify the CiDi status chip shows expected values (ADS/SIGNED IN as configured).
   - Tap WATCH AD; ensure rewards are only granted when the SDK returns success === true.
   - Play a run to ensure reportTournamentScore() is invoked and accepted by the proxy endpoint.

2. Pi mainnet checks (inside Pi Browser)
   - Open the app inside Pi Browser with a user who has Mainnet wallet privileges.
   - Attempt a U2A purchase via the UI; confirm the flow triggers onReadyForServerApproval and onReadyForServerCompletion and the server endpoints succeed.
   - Confirm no sensitive data is logged to client-side logs.

Rollback plan

- If a critical problem occurs after merge, revert the merge commit on `main` and redeploy the previous release. Investigate logs and fix the issue in a hotfix branch, then reopen a PR.

Notes and links

- Pidex manifest: mainnet/pidex/manifest.json
- Beta .env.example: beta/.env.example
- Payment server code: src/lib/pi-payments.functions.ts
- Payment client UI: src/components/PiPaymentButton.tsx

