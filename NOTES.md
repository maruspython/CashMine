# Notes

## Decisions

**1. Amounts.** All money is a `BigInt` in the asset's smallest unit (`src/money/`), never a JS `number`. The real API sends ETH as `"12.365678901234591676"`; a `number` turns that into `12.365678901234592`. Server amounts are parsed strictly by the documented format, and bad data shows an error, not a guess. User input: spaces are trimmed and one comma counts as the decimal point (many phone keyboards only have a comma), then the same strict rules apply. So "1,000" means 1, and the review screen shows the amount large. Too many decimals is an error, never rounded. USD is exact (amount × price), added up, then rounded to cents once.
*Not chosen:* `number` (float errors); big.js (it accepts `1e-3` and `.5`, so I would need my own strict parser anyway).

**2. Balance right after a claim.** I asked the AI for approaches first (ai-logs: "Decision 2: the balance right after a claim"). A, server data only, brings back "I claimed and my balance didn't change, so I claimed again". B, subtract and replace on the next fetch, jumps back up when that snapshot is older than the claim. **I chose C:** the snapshot plus only the claim changes it has not seen yet (`src/balances/adjust.ts`, table and tests in `adjust.test.ts`). The balance changes at once. The change goes away only when the snapshot already includes the claim, so it never jumps back. A failed claim stops counting at once; that is the only jump up, and Home shows the reason. Max and validation use this adjusted `available`.
*Assumptions:* `updatedAt` is the time a claim settled, and a snapshot has seen an event when its time ≤ `asOf`. Claims with an unknown result are not adjusted.

**3. Unknown claim result.** The Idempotency-Key and the exact body are saved before the first POST. After a timeout, network error, 5xx or 429, the app sends them again after 1, 2, 4 and 8 s. Then it shows "Check again" and "Do not claim again: you will not be charged twice". New claims for that asset are blocked until the result is known, also after a reload (the app resumes the request). Only a 400 proves nothing was claimed; after an unknown try, a 401, 404 or 409 keeps the claim unknown. I checked this on the real API with BTC:
- claim all BTC: 201
- same key and body: 200 `Idempotent-Replayed`, not a 400, even though available was now too low
- same key, other body: 409
- new key: 400

**Others.**
- The headline is "Total incl. pending" (available + pending + claiming), because pending is not final.
- No default destination: the user must pick one, and the review screen shows it.
- Options are reloaded before review; after submit, the server's fee and receive amount are shown.
- The token is checked before it is saved, and any 401 returns to the token screen. Local claims are stored per token.
- `web.output: "single"`: no SEO need and no build-time render.

## Working with AI

I used Claude Code in VS Code; the session is in `ai-logs/`. The quotes are my prompts, so you can search for them.

- **A prompt that did not get what I wanted.** My step 4 prompt said nothing about navigation. The AI used `router.replace('/')`, so Home got a back arrow (I saw it testing at 390 px). In the next prompt I named the API to use. Search: "home screen has a back arrow".
- **AI output that was wrong or risky.** In the retry loop, a 401 or 409 after an unknown try showed "Nothing was claimed". That is false: the first try may have created the claim. I found it by reading `claims-context.tsx`. The AI moved the rule into a pure function with tests (`post-outcome.ts`), and I checked the assumption on the real API. Search: "find one problem in claims-context". The AI also once wrote wrong expected USD values in a test and caught it itself with Python: search "off by 2 cents".
- **Where I disagreed.** The AI planned the old root `app/` folder and kept static rendering with localStorage workarounds. I told it that SDK 58 uses `src/app` and to use `web.output: "single"`. Search: "some fixes to your plan". I also stopped it running `git stash` on my uncommitted work: search "dont use git stash".

## Not done / known issues

- **Activity is not built;** I put the claim flow first. Next I would add it with `useInfiniteQuery` and `nextCursor`.
- **The fee can change between review and submit,** because the POST has no fee field. I reload it before review and show the server's numbers after.
- **If the token expires while a claim is unknown,** the claim resumes only when the same token is entered again.
- **Claims from another tab or device** are not adjusted locally; they show with the next snapshot (≤ 15 s).
- **A claim that returns 404** keeps being polled every 2 s.
- **No component tests and no ESLint.** Unused template packages are still in `package.json`.

Next: Activity, claim-flow tests with a mocked `fetch`, and tab sync with the `storage` event.
