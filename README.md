# Futacoin — $FUTA

A Solana memecoin about Futa, the red panda who stood up in 2005 and was certified by Guinness World Records on
17 November 2026 as the oldest living red panda in captivity (23 years, 135 days). $FUTA routes creator rewards,
on-chain through donate.gg, to **Red Panda Network**.

- Site: `index.html`, `style.css`, `main.js` (GSAP/ScrollTrigger/Lenis scroll scenes), `i18n.js` (EN / 日本語 switch),
  `meter.js` (Bamboo Ledger client). Images in `assets/img/` (`og.jpg` is the link-preview image).
- API: `api/meter.js`, a Vercel serverless function (core logic in `api/_lib/meter-core.js`).

## Launch config

Set the contract address in two places that must stay equal (a test checks this):

1. **Front end**: `CONFIG` at the top of `main.js` (`CA`, `X_URL`). The CA buttons and every X button read it.
2. **Bamboo Ledger**: `EXPECTED.mint` in `api/_lib/meter-core.js`.

Until the mint is set, `/api/meter` answers `{ "prelaunch": true }` and the tracker shows "Awaiting launch".
Before the first trade the fee-sharing account doesn't exist on-chain yet; the API reports `"onchain": "not_created"`
and the page shows "Ready · waiting for first trade". No redeploy is needed when trading starts.

After the first settled donation, optionally pin `EXPECTED.configId` to that receipt's `donationReceipt.config.id`
so receipts from any other donation config are rejected.

Link previews (X, Telegram, Discord) need an absolute image URL: once the domain is live, change `og:image` and
`twitter:image` in `index.html` to `https://<domain>/assets/img/og.jpg`.

## The Bamboo Ledger (settled donations, server-side)

The donated total counts **only $FUTA donations already settled through donate.gg to Red Panda Network**, read from
donate.gg's public receipts API (`charities/491287d7-6fc5-5630-9f47-98ec95b74da5/donations`, Red Panda Network,
EIN 26-1103671):

```text
donated = sum(usdGrossE6 of settled $FUTA receipts) / 1,000,000   (full USDC amount of each donation)
```

Same accounting rules as the Foodcoin and Watercoin trackers: every page is read before publishing, receipts must match
the mint, Solana, the Pump Fees donation source, Red Panda Network, USDC settlement and a wrapped-SOL input, amounts are
checked (`gross = net + fee + tip`), receipts are deduplicated by id, and already-counted history must stay unchanged.
Creator-vault and donation-account balances are read from Solana and shown as *on the way* (not counted).

The gauge fills toward the next goal: $5k → $20k → $50k → $100k → $250k (`GOALS` in `meter.js`).

Optional Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `SOLANA_RPC_URLS` | Comma-separated RPC URLs, primary first. |
| `DONATE_API_KEY` | donate.gg API key for a higher rate limit. |

## Run locally

```bash
npm install
```

```bash
npm run dev
```

Serves the site and `/api/meter` on http://localhost:5174.

```bash
npm test
```

## Deploy

Vercel: import the repo, no build step. The static site and the `/api/meter` function deploy together.
A static-only host (e.g. GitHub Pages) shows the site, but the tracker stays "Offline" without the API.
