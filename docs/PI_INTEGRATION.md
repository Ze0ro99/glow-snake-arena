# Pi Network Integration

## Domain verification

- Mainnet key served at: https://glow-snake-arena.lovable.app/validation-key.txt
- Mainnet copy: /validation-key.mainnet.txt
- Testnet copy: /validation-key.testnet.txt

If the Pi Developer Portal rotates a key, replace the contents of
`public/validation-key.txt` (and the matching `.mainnet.txt` / `.testnet.txt`
copy) with the new value and re-publish.

## Credentials (stored as Lovable Cloud secrets)

| Secret                      | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `SESSION_SECRET`            | Encrypts Pi session cookie                  |
| `PI_API_KEY_TESTNET`        | Pi Platform API key (Testnet)               |
| `PI_API_KEY_MAINNET`        | Pi Platform API key (Mainnet)               |
| `PI_SERVER_API_KEY`         | Alias of the active server key (mainnet)    |
| `PI_WALLET_ADDRESS_TESTNET` | Testnet app wallet address (multi-sig auth) |

Values live only in encrypted secret storage — never in source control.

## SDK / auth flow

1. Client loads `https://sdk.minepi.com/pi-sdk.js` and calls
   `Pi.init({ version: "2.0" })` (or `{ sandbox: true }` in Pi Testnet).
2. `Pi.authenticate(["username"], onIncompletePayment)` returns an access token.
3. Client posts the token to `verifyPiToken` server fn, which validates it via
   `GET https://api.minepi.com/v2/me` using the user's bearer token and stores
   `{ uid, username }` in an httpOnly session cookie.

## Payments (U2A)

Server functions in `src/lib/pi-payments.functions.ts`:

- `approvePiPayment({ paymentId, network })` → `POST /v2/payments/:id/approve`
- `completePiPayment({ paymentId, txid, network })` → `POST /v2/payments/:id/complete`
- `cancelIncompletePiPayment({ paymentId, network })` → cancel abandoned payments
- `getPiPaymentConfig()` → non-secret client hints (which networks are configured)

The `network` argument (`"testnet" | "mainnet"`) selects which server API key
is used to authorize the request against the Pi Platform.

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
