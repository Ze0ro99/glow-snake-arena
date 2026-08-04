# Main and branch strategy

This repository is organized for CiDi-first deployment on the main branch, with Pi Network payment integration available in dedicated branches.

Branches:
- main — CiDi-focused, Pi client disabled (no Pi SDK auto-load). Use for publishing the offline product route.
- mainnet — Pi production-enabled branch (server must provide PI_NETWORK_API_KEY via environment secrets).
- beta — Pi testnet-enabled branch (server must provide PI_API_KEY_TESTNET and PI_APP_WALLET_SEED_TESTNET via environment secrets).

Security
- Do NOT commit API keys, wallet seeds, or validation keys to the repository.
- Use your hosting provider's secret manager (Lovable) to store: SESSION_SECRET, PI_NETWORK_API_KEY, PI_API_KEY_TESTNET, PI_APP_WALLET_SEED_TESTNET, PI_APP_WALLET_SEED_MAINNET, VITE_CIDI_API_KEY, SUPABASE_SERVICE_KEY, etc.

