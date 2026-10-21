# CashMine payback

**Live:** https://olehmarusdev-cashmine.expo.app

Open it on a phone and paste your API token. The app keeps the token in this browser only. You can change it with "Change API token" on Home.

## Run locally

I used Node 24.

```bash
npm install
npm run web        # starts Expo and opens the app in the browser
npm test           # unit tests
npx tsc --noEmit   # typecheck
```

- The API base URL is in `src/config.ts`.
- Build: `npx expo export --platform web` writes the site to `dist/`.
- Deploy: `npx eas-cli@latest deploy --prod`.

## What works

- **Token:** the app checks the token before saving it. An invalid or expired token brings you back to the token screen.
- **Balances (Home):**
  - each asset's available, pending and claiming amounts
  - "Total incl. pending" and "available to claim" in USD
  - when the data was updated, and a Refresh button
  - loading, error and retry states, and an automatic refresh every 15 s
- **Claim:**
  - pick where the money goes, then enter an amount or tap Max
  - see the fee and the amount you receive, review, confirm
  - input is checked against the API rules
  - safe retries with an Idempotency-Key, and "Check again" when the result is unknown
- **Claim status:** follows the claim until it completes or fails, and shows the failure reason. "Your claims" on Home lists claims that are in progress or just finished.
- **Balance after a claim:** changes at once and never jumps back (see `NOTES.md`).
- **Unit tests:** amount parsing and validation, fee, USD totals, the claim retry rule, and the balance adjustment.

**Not done:** Activity (history). See `NOTES.md` for decisions and known issues.
