awesome — here are the **two prompt blocks** you asked for. First is the **Relayer** (Flare → Lisk selection), then the **Maker Bot** (quotes commit/reveal). They’re copy-pasteable instructions for a code generator or for you to follow by hand.

---

# PROMPT A — Relayer (Flare → Lisk)

**Goal:** fetch **FTSO snapshot** + **Secure RNG** on **Flare Coston2**, then call **`QuoteBook.selectBest(...)`** on **Lisk Sepolia** for a given RFQ.

## 1) Files & folders

```
apps/relayer/
├─ src/
│  ├─ config.ts         # env parsing & addresses
│  ├─ clients.ts        # viem clients (Lisk + Flare)
│  ├─ abis.ts           # minimal ABIs (FTSOReader, RNGReader, QuoteBook)
│  ├─ ftso.ts           # take price snapshot on Flare
│  ├─ rng.ts            # draw secure randomness on Flare
│  ├─ selector.ts       # glue: snapshot + rng → QuoteBook.selectBest on Lisk
│  ├─ index.ts          # CLI entry (rfqId in, logs out)
│  └─ logger.ts         # leveled logger
├─ package.json
├─ tsconfig.json
└─ .env.example
```

## 2) Dependencies

```
pnpm add viem zod dotenv commander
pnpm add -D ts-node typescript @types/node
```

## 3) .env.example

```
PRIVATE_KEY=0xYOUR_TEST_KEY
LISK_RPC=https://rpc.sepolia-api.lisk.com
FLARE_RPC=https://coston2-api.flare.network/ext/C/rpc
# addresses written by your deploy scripts:
QUOTE_BOOK=0x...
FTSO_READER=0x...
RNG_READER=0x...
SYMBOL=ETH/USD         # or the symbol your FTSOReader expects (bytes32)
CHAIN_ID_LISK=4202
CHAIN_ID_FLARE=114
MAX_DEVIATION_BPS=300  # optional: mirror contract setting for logging
```

## 4) `src/config.ts` (env + addresses)

* Read `.env`, validate with `zod`, export a typed `cfg`.
* Load `deploy-config/addresses.json` if you prefer, then override with env.

## 5) `src/clients.ts` (viem clients)

* Build **public + wallet** clients for both chains.

```ts
import { createPublicClient, createWalletClient, http, defineChain, privateKeyToAccount } from "viem";

export const liskSepolia = defineChain({
  id: 4202, name: "Lisk Sepolia", network: "lisk-sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [process.env.LISK_RPC!] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://sepolia-blockscout.lisk.com" } },
});

export const coston2 = defineChain({
  id: 114, name: "Flare Coston2", network: "coston2",
  nativeCurrency: { name: "C2FLR", symbol: "C2FLR", decimals: 18 },
  rpcUrls: { default: { http: [process.env.FLARE_RPC!] } },
  blockExplorers: { default: { name: "Flarescan", url: "https://coston2.testnet.flarescan.com" } },
});

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

export const liskPub = createPublicClient({ chain: liskSepolia, transport: http() });
export const liskWal = createWalletClient({ chain: liskSepolia, transport: http(), account });

export const flarePub = createPublicClient({ chain: coston2, transport: http() });
export const flareWal = createWalletClient({ chain: coston2, transport: http(), account });
```

## 6) `src/abis.ts` (minimal ABIs)

Like we also have the abis for the lisk contracts and the flare contracts see artifacts folder (ls into it)

```ts
export const FTSO_READER_ABI = [
  { "type":"event","name":"PriceSnapshotted","inputs":[
    {"indexed":false,"name":"snapshotId","type":"uint256"},
    {"indexed":false,"name":"symbol","type":"bytes32"},
    {"indexed":false,"name":"price","type":"uint256"},
    {"indexed":false,"name":"timestamp","type":"uint256"}]},
  { "type":"function","stateMutability":"nonpayable","name":"snapshot","inputs":[{"name":"symbol","type":"bytes32"}],
    "outputs":[{"type":"uint256"},{"type":"uint256"},{"type":"uint256"}] }
] as const;

export const RNG_READER_ABI = [
  { "type":"event","name":"RngDrawn","inputs":[
    {"indexed":false,"name":"value","type":"uint256"},
    {"indexed":false,"name":"isSecure","type":"bool"},
    {"indexed":false,"name":"epochTimestamp","type":"uint256"}]},
  { "type":"function","stateMutability":"nonpayable","name":"draw","inputs":[],"outputs":[
    {"type":"uint256"},{"type":"bool"},{"type":"uint256"}] }
] as const;

export const QUOTE_BOOK_ABI = [
  { "type":"function","stateMutability":"nonpayable","name":"selectBest",
    "inputs":[
      {"name":"rfqId","type":"uint256"},
      {"name":"rngValue","type":"uint256"},
      {"name":"isSecure","type":"bool"},
      {"name":"snapshotId","type":"uint256"},
      {"name":"refPrice","type":"uint256"}],
    "outputs":[] },
  { "type":"event","name":"BestSelected","inputs":[
    {"indexed":true,"name":"rfqId","type":"uint256"},
    {"indexed":false,"name":"maker","type":"address"},
    {"indexed":false,"name":"winnerIndex","type":"uint256"},
    {"indexed":false,"name":"snapshotId","type":"uint256"},
    {"indexed":false,"name":"refPrice","type":"uint256"},
    {"indexed":false,"name":"rngValue","type":"uint256"},
    {"indexed":false,"name":"rngSecure","type":"bool"}] }
] as const;
```

## 7) `src/ftso.ts`

* Convert string symbol to `bytes32` (right-padded).
* `writeContract` to Flare `FTSOReader.snapshot(symbol32)`.
* Return `{ snapshotId, price, ts, txHash }`.

## 8) `src/rng.ts`

* `writeContract` to Flare `RNGReader.draw()`.
* Return `{ value, isSecure, epochTimestamp, txHash }`.

## 9) `src/selector.ts`

* Accept `rfqId` as arg.
* Call `ftso.snapshot`, then `rng.draw`.
* **Require** `isSecure === true`; otherwise throw.
* `writeContract` on Lisk `QuoteBook.selectBest(rfqId, value, isSecure, snapshotId, price)`.
* Wait for receipt; then `getLogs` for `BestSelected` and print a clean summary with explorer links.

## 10) `src/index.ts` (CLI)

* Use `commander`:

  * `relayer select --rfq <id> [--symbol ETH/USD]`
* Wire to `selector.ts`.

## 11) `logger.ts`

* Small console formatter with timestamps + chain explorers in logs.

## 12) package.json scripts

```json
{
  "scripts": {
    "build": "tsc -p .",
    "relayer:select": "ts-node apps/relayer/src/index.ts select"
  }
}
```

## 13) Acceptance checklist

* Running `pnpm relayer:select --rfq 1 --symbol ETH/USD`:

  * Emits two **Flare** tx hashes (snapshot + rng) and one **Lisk** tx hash (selectBest).
  * Prints the decoded `BestSelected` event.
  * Exits non-zero if `isSecure` is `false` or if no revealed quotes exist.

---

# PROMPT B — Maker Bot (quotes commit/reveal)

**Goal:** listen to **Lisk** RFQ lifecycle, generate quotes, then **commit** and **reveal** them automatically.

## 1) Files & folders

```
apps/maker-bot/
├─ src/
│  ├─ config.ts         # env (spreads, throttles), addresses
│  ├─ clients.ts        # viem Lisk public + wallet clients
│  ├─ abis.ts           # IIntentRegistry, IQuoteBook (minimal)
│  ├─ strategy.ts       # price model → quoteOut
│  ├─ quotes.ts         # commit/reveal helpers (salts, hashes)
│  ├─ schedule.ts       # window polling / retries / backoff
│  └─ index.ts          # main loop + event subscriptions
├─ package.json
├─ tsconfig.json
└─ .env.example
```

## 2) Dependencies

```
pnpm add viem zod dotenv
pnpm add -D ts-node typescript @types/node
```

## 3) .env.example

```
PRIVATE_KEY=0xYOUR_TEST_KEY
LISK_RPC=https://rpc.sepolia-api.lisk.com
INTENT_REGISTRY=0x...
QUOTE_BOOK=0x...
TOKEN_IN=0x...   # for this market
TOKEN_OUT=0x...
SPREAD_BPS=30    # 0.30% maker spread
SLIPPAGE_CAP_BPS=300
JITTER_MS=1200   # random delay to avoid same-block collisions
```

## 4) `src/abis.ts` (minimal ABIs)

```ts
export const INTENT_REGISTRY_ABI = [
  { "type":"event","name":"IntentRevealed","inputs":[
    {"indexed":true,"name":"rfqId","type":"uint256"},
    {"indexed":true,"name":"owner","type":"address"},
    {"indexed":false,"name":"amountIn","type":"uint256"},
    {"indexed":false,"name":"maxSlippageBps","type":"uint256"},
    {"indexed":false,"name":"tokenIn","type":"address"},
    {"indexed":false,"name":"tokenOut","type":"address"}] },
  { "type":"function","name":"getRFQ","stateMutability":"view",
    "inputs":[{"name":"rfqId","type":"uint256"}],
    "outputs":[{"type":"tuple","components":[
      {"name":"owner","type":"address"},
      {"name":"tokenIn","type":"address"},
      {"name":"tokenOut","type":"address"},
      {"name":"expiry","type":"uint256"},
      {"name":"amountIn","type":"uint256"},
      {"name":"maxSlippageBps","type":"uint256"},
      {"name":"commitment","type":"bytes32"},
      {"name":"status","type":"uint8"}]}] }
] as const;

export const QUOTE_BOOK_ABI = [
  { "type":"function","name":"commitQuote","stateMutability":"nonpayable",
    "inputs":[{"name":"rfqId","type":"uint256"},{"name":"commitment","type":"bytes32"}],"outputs":[] },
  { "type":"function","name":"revealQuote","stateMutability":"nonpayable",
    "inputs":[{"name":"rfqId","type":"uint256"},{"name":"quoteOut","type":"uint256"},{"name":"salt","type":"bytes32"}],"outputs":[] },
  { "type":"event","name":"QuoteCommitted","inputs":[
    {"indexed":true,"name":"rfqId","type":"uint256"},{"indexed":true,"name":"maker","type":"address"}] },
  { "type":"event","name":"QuoteRevealed","inputs":[
    {"indexed":true,"name":"rfqId","type":"uint256"},{"indexed":true,"name":"maker","type":"address"},{"indexed":false,"name":"quoteOut","type":"uint256"}] }
] as const;
```

## 5) `src/clients.ts` (Lisk clients)

* Build **wallet** + **public** clients with `viem` (same as relayer but only Lisk).

## 6) `src/strategy.ts` (pricing)

* Export `computeQuoteOut({ amountIn, refPrice, spreadBps, tokenInDecimals, tokenOutDecimals })`.
* Example logic (feel free to adjust):

  * `unitPrice = refPrice * (1 - spreadBps/10000)`
  * `quoteOut = amountIn * unitPrice * 10^(tokenOutDecimals - tokenInDecimals)`
* Get `refPrice`:

  * Option A (simple): static value from `.env` during dev.
  * Option B (better): call a tiny REST endpoint the **Relayer** exposes with the **last FTSO snapshot** price.
  * Option C (graduate): read your **FTSOReader** view state directly (if you added one).

## 7) `src/quotes.ts` (commit/reveal helpers)

* `randomSalt(): `0x\${32 bytes}\` from crypto.
* `buildCommitment(quoteOut, salt) = keccak256(abi.encode(quoteOut, salt))`.
* `commit(rfqId, commitment)` → `QuoteBook.commitQuote`.
* `reveal(rfqId, quoteOut, salt)` → `QuoteBook.revealQuote`.

## 8) `src/schedule.ts` (windowing + retries)

* Poll `IntentRegistry.getRFQ(rfqId)` and contract window constants (if exposed), or:

  * **Heuristic**: try commit immediately after `IntentRevealed`; if revert “CommitWindowClosed”, ignore; else store success.
  * For reveal: after `commitQuote` success, **wait** `makerCommitWindow` seconds (config) plus `JITTER_MS`, then submit `revealQuote`. If revert “RevealNotOpen”, backoff and retry every 5s.
* Keep a tiny JSON store in `apps/maker-bot/.state/quotes.json` to avoid double-reveals after restarts.

## 9) `src/index.ts` (main)

* Boot clients, parse `.env`.
* Subscribe to `IntentRevealed` via `watchContractEvent`.
* For each RFQ:

  1. Pull RFQ details, skip if expired or wrong pair.
  2. Compute `quoteOut` via strategy.
  3. Salt + commitment → `commitQuote`.
  4. Schedule a reveal at the right time.
* Log tx hashes + explorer links.

## 10) package.json scripts

```json
{
  "scripts": {
    "build": "tsc -p .",
    "maker:run": "ts-node apps/maker-bot/src/index.ts"
  }
}
```

## 11) Acceptance checklist

* Start bot → it logs “watching” and your maker address.
* When you **reveal an RFQ** on Lisk:

  * Bot commits within the commit window and logs `QuoteCommitted`.
  * After the reveal window opens, it reveals and logs `QuoteRevealed`.
* You can see both events on **Blockscout** and in contract logs.

---

## Recommended build order (quick reminder)

1. **Relayer** (so `selectBest` is truly Flare-powered).
2. **Maker Bot** (so the app has real quotes).
3. **Frontend** (so you’re skinning a working pipeline).
