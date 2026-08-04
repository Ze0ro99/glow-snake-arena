# CiDi Games Integration — Neon Slither 4D

Route: **OFFLINE product** (browser client + platform proxy SDK; no CiDi game server).
Docs: https://developdoc.cidi.games · Developer Center: https://develop.cidi.games

## What is implemented in code

| Requirement | Where | Status |
| --- | --- | --- |
| `CiDiSDK.init()` runs before the first `localStorage` read/write (Pi Browser / iOS rule) | `src/lib/cidi.ts` → `initCidi()`, awaited in `src/routes/index.tsx` before any storage access; all persistence effects gated by `storageReady` | Done |
| SDK file `https://app.cidi.games/sdk/cidi-sdk.js` loaded | `src/lib/cidi.ts` | Done |
| Offline proxy SDK `cidi-proxy-sdk.umd.js` + `CidiProxySDK.createClient({ baseURL, apiKey })` | `src/lib/cidi.ts` | Done |
| Launch URL accepts `tempToken` | `/?tempToken=<token>` — read by `getTempToken()`; SDK also reads it automatically | Done |
| `client.auth.login()` before any reporting, re-run on every page load (token kept in memory only) | `initCidi()` / `reportTournamentScore()` | Done |
| Rewarded ad via `CiDiSDK.showRewardedAd()`, reward granted **only** when `success === true` | `showRewardedAd()` + "WATCH AD · +250 ◎" button on the start screen | Done |
| Tournament score reporting `client.report.tournamentScore({ score, reportedAt })` after the result is final | called from `endGame()` | Done |
| Payment SDK NOT used on the offline route | Pi Network U2A/A2U payments are separate (see `PI_INTEGRATION.md`) | Done |
| `API Secret` / `Callback Secret` never in client code | only the public `apiKey` is used client-side | Done |
| App Authentication `validation-key.txt` on the production `https://` URL | `public/validation-key.txt` → https://glow-snake-arena.lovable.app/validation-key.txt | Done |
| Errors, timeouts, retries handled | ad timeout 30s, script load timeout 8s, failures degrade to standalone play | Done |

## Configuration required from the Developer Center

Set these env vars (Developer Center → App Key):

```
VITE_CIDI_API_KEY=<apiKey issued by the proxy service>
VITE_CIDI_BASE_URL=https://elf-proxy.cidi.games/api/v1   # optional, this is the default
```

Without `VITE_CIDI_API_KEY` the game still runs and ads still work; login,
tournament and medal reporting stay disabled (status chip shows `GUEST`).

## Platform items to complete in the Developer Center (not code)

- Project Information (English name, developer, category, screen direction = portrait,
  intros, languages, test link) + icon / library background / operation images /
  editor + tournament banners.
- Product Architecture = `OFFLINE`.
- App Authentication: submit `https://glow-snake-arena.lovable.app` (validation key already deployed).
- App Key for production and sandbox; production server IP whitelist.
- Login SDK launch URL: `https://glow-snake-arena.lovable.app/`
  (platform appends `?tempToken=...`).
- Tournament rule text (≤ 80 chars), e.g. "Highest snake length in a single run. Top 10 ranked per season."
- Enable integration completion markers after sandbox testing.

## Manual test

1. Open `https://glow-snake-arena.lovable.app/?tempToken=<token>` in Pi Browser.
2. Start screen shows `CIDI GAMES` panel: `ADS` + `SIGNED IN` when configured.
3. Tap **WATCH AD · +250 ◎** → credits increase only after a completed ad.
4. Play a run, die → score is reported to the tournament ranking.
5. Refresh → login is re-run, saved progress (skins, credits, score log) is intact.
