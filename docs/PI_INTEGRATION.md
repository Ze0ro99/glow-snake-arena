# Pi Network Integration

## Domain verification

- Mainnet key served at: https://glow-snake-arena.lovable.app/validation-key.txt
- Mainnet copy: /validation-key.mainnet.txt
- Testnet copy: /validation-key.testnet.txt

If the Pi Developer Portal rotates a key, replace the contents of
`public/validation-key.txt` (and the matching `.mainnet.txt` / `.testnet.txt`
copy) with the new value and re-publish.

## Credentials (stored as Lovable Cloud secrets)

| Secret                       | Purpose                                     |
| ---------------------------- | ------------------------------------------- |
| `SESSION_SECRET`             | Encrypts Pi session cookie                  |
| `PI_NETWORK_API_KEY_ACTIVE`  | Active Pi Platform API key (Mainnet)        |
| `PI_API_KEY_TESTNET`         | Pi Platform API key (Testnet)               |
| `PI_APP_WALLET_SEED_TESTNET` | Testnet app wallet seed (A2U payouts)       |
| `PI_APP_WALLET_SEED_MAINNET` | Mainnet app wallet seed                     |
| `PI_WALLET_ADDRESS_MAINNET`  | Mainnet app wallet address                  |
| `PI_WALLET_ADDRESS_TESTNET`  | Testnet app wallet address (multi-sig auth) |

Values live only in encrypted secret storage — never in source control.

## SDK / auth flow

1. Client loads `https://sdk.minepi.com/pi-sdk.js` and awaits
   `Pi.init({ version: "2.0" })`.
2. `Pi.authenticate(["username", "payments"], onIncompletePaymentFound)` returns
   an access token. `onIncompletePaymentFound` always completes the in-flight
   payment through `completePiPayment` — it is never ignored.
3. Client posts the token to `verifyPiToken`, which validates it via
   `GET https://api.minepi.com/v2/me` and stores `{ uid, username }` in an
   httpOnly session cookie.

## Products (U2A, Mainnet)

Catalog lives in `src/lib/pi-products.ts` and is shared by client and server:

| Product ID      | Sold as             | Amount    |
| --------------- | ------------------- | --------- |
| `arena_entry`   | Arena Entry Ticket  | 0.00001 π |
| `skin_unlock`   | Skin Unlock         | 0.00001 π |
| `extra_lives`   | Extra Lives (3)     | 0.00001 π |
| `credits_topup` | Credits Top-Up      | 0.00001 π |

`Pi.createPayment` sends `{ amount, memo, metadata: { product } }` from the
catalog. `approvePiPayment` re-reads `GET /v2/payments/:id` server-side and
rejects the payment unless the amount and memo match the catalog entry and the
payment belongs to the authenticated Pi uid.

## Payments (server functions in `src/lib/pi-payments.functions.ts`)

- `approvePiPayment({ paymentId, network, productId })` → validate + `POST /v2/payments/:id/approve`
- `completePiPayment({ paymentId, txid, network })` → `POST /v2/payments/:id/complete`
- `cancelIncompletePiPayment({ paymentId, network })` → cancel abandoned payments
- `claimTestnetPi()` → A2U 1 π Testnet payout (Mainnet wallet requirement)

All server-to-server calls use `Authorization: Key <api key>`; the Mainnet key
is read from `PI_NETWORK_API_KEY_ACTIVE`.


## Multi-sig wallet

The Testnet wallet `GBOXYLMEY6BYAFYJCBFOBBZADCKFNIC5KW7IJMGUEFIDVUBSADOU3BOO`
is registered as a co-signer on the Mainnet app wallet and is used to
authenticate payment authorization on the Mainnet from the Testnet
environment. Do not expose this address in client code — it is available
server-side via `PI_WALLET_ADDRESS_TESTNET`.

## Checklist

- [x] `validation-key.txt` present (Mainnet)
- [x] Testnet + Mainnet key copies published
- [x] Server + client Pi SDK auth wired
- [x] U2A payment approve/complete/cancel server fns
- [x] Secrets stored in Lovable Cloud
- [ ] Verify domain in Pi Developer Portal (Testnet round → Mainnet round)
- [ ] Submit app for Mainnet review after Testnet round passes
