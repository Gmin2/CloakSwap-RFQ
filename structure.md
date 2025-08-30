

---

# PROMPT 1 — Repository & file structure

**Instruction to builder:**
Create a TypeScript Hardhat monorepo with the following structure and empty files. Use `pnpm` (or `npm`) and `solc 0.8.27`.

```
cloakswap/
├─ contracts/
│  ├─ lisk/
│  │  ├─ IntentRegistry.sol
│  │  ├─ QuoteBook.sol
│  │  ├─ SettlementVault.sol
│  │  └─ interfaces/
│  │     ├─ IIntentRegistry.sol
│  │     ├─ IQuoteBook.sol
│  │     └─ ISettlementVault.sol
│  └─ flare/
│     ├─ FTSOReader.sol
│     ├─ RNGReader.sol
│     └─ FDCClient.sol         // optional (cross-chain receipts)
├─ scripts/
│  ├─ deploy-lisk.ts
│  ├─ deploy-flare.ts
│  ├─ wire-lisk.ts             // set addresses/roles post-deploy
│  ├─ seed-demo.ts             // mint mock tokens, fund vault
│  └─ sanity-check.ts          // quick read tests on deployments
├─ test/
│  ├─ rfq.commit.reveal.spec.ts
│  ├─ quotes.commit.reveal.spec.ts
│  ├─ selection.rng.ftso.spec.ts
│  └─ settlement.vault.spec.ts
├─ deploy-config/
│  └─ addresses.json           // populated after deploys
├─ hardhat.config.ts
├─ package.json
├─ .env.example
└─ README.md
```

---

# PROMPT 2 — Lisk contracts: responsibilities & interfaces

**Instruction to builder:**
Implement the following **Solidity interfaces** and semantics on **Lisk** (Lisk Sepolia during dev). Focus on safety, events, and windowed phases.

### 2.1 `IntentRegistry.sol` (Lisk) ✅ IMPLEMENTED

* **Purpose:** manage RFQ lifecycle for takers (commit → reveal).
* **Storage:**

  * `struct RFQ { address owner; address tokenIn; address tokenOut; uint256 expiry; uint256 amountIn; uint256 maxSlippageBps; bytes32 commitment; uint8 status; }`
  * `mapping(uint256 => RFQ) public rfqs; uint256 public nextRFQId;`
* **Functions:**

  ```solidity
  function commitRFQ(address tokenIn, address tokenOut, uint256 expiry, bytes32 commitment) external returns (uint256 rfqId);
  function revealRFQ(uint256 rfqId, uint256 amountIn, uint256 maxSlippageBps, bytes32 salt) external;
  function getRFQ(uint256 rfqId) external view returns (RFQ memory);
  ```
* **Rules:** `commitment == keccak256(abi.encode(amountIn, maxSlippageBps, salt))` on reveal.
* **Events:** `RFQCommitted(rfqId, owner, tokenIn, tokenOut, amountIn, expiry)`, `RFQRevealed(rfqId, amountIn, maxSlippageBps)`.

### 2.2 `QuoteBook.sol` (Lisk)

* **Purpose:** maker quotes (commit → reveal), validate against Flare price snapshot, pick winner, then trigger settlement.
* **Storage:**

  * `struct Quote { address maker; uint256 quoteOut; bytes32 commitment; uint8 status; }`
  * `mapping(uint256 => Quote[]) public quotes;`
  * `uint64 public makerCommitWindow; uint64 public makerRevealWindow;`
  * `uint256 public maxDeviationBps; // sanity band vs refPrice`
  * `struct SelectionMeta { uint256 snapshotId; uint256 refPrice; uint256 rngValue; bool rngSecure; uint256 winnerIndex; }`
  * `mapping(uint256 => SelectionMeta) public selection;`
  * `address public settlementVault; address public intentRegistry;`
* **Functions:**

  ```solidity
  function commitQuote(uint256 rfqId, bytes32 commitment) external;
  function revealQuote(uint256 rfqId, uint256 quoteOut, bytes32 salt) external;
  function selectBest(uint256 rfqId, uint256 rngValue, bool isSecure, uint256 snapshotId, uint256 refPrice) external;
  ```
* **Selection logic:** ensure RFQ revealed & windows ended; discard quotes outside `maxDeviationBps` of `refPrice`; choose best (max `quoteOut` for taker) and if tie, use `rngValue % ties` but only if `isSecure == true`.
* **Events:** `QuoteCommitted(rfqId, maker)`, `QuoteRevealed(rfqId, maker, quoteOut)`, `BestSelected(rfqId, maker, winnerIndex, snapshotId, refPrice, rngValue, rngSecure)`.

### 2.3 `SettlementVault.sol` (Lisk)

* **Purpose:** hold maker liquidity/escrow and perform transfers on fill.
* **Storage:** token allowlist, balances per maker/token if escrow model; `address public quoteBook; address public feeCollector; uint256 public feeBps;`
* **Functions:**

  ```solidity
  function fund(address token, uint256 amount) external;
  function withdraw(address token, uint256 amount) external;
  function fulfill(uint256 rfqId) external; // only QuoteBook
  ```
* **Fulfill flow:** pull `amountIn` from taker (requires `approve`), transfer `quoteOut` of `tokenOut` to taker, send `amountIn - fee` of `tokenIn` to maker, emit:
  `FillCommitted(rfqId, taker, maker, tokenIn, tokenOut, amountIn, quoteOut, fee)`.
* **Guards:** reentrancy protection, safe ERC20 transfers, only-QuoteBook modifier.

---

# PROMPT 3 — Flare helper contracts

**Instruction to builder:**
Deploy these tiny helpers on **Flare Coston2** (testnet) and call them from an off-chain relayer to feed data into Lisk selection.

### 3.1 `FTSOReader.sol` (Flare)

```solidity
event PriceSnapshotted(uint256 snapshotId, bytes32 symbol, uint256 price, uint256 timestamp);
function snapshot(bytes32 symbol) external returns (uint256 snapshotId, uint256 price, uint256 timestamp);
```

* Read latest median price for `symbol` from FTSO; increment a local `snapshotId`; emit event with `price, timestamp`.

### 3.2 `RNGReader.sol` (Flare)

```solidity
event RngDrawn(uint256 value, bool isSecure, uint256 epochTimestamp);
function draw() external returns (uint256 value, bool isSecure, uint256 epochTimestamp);
```

* Read Secure Random Number and emit.

### 3.3 `FDCClient.sol` (optional)

* Expose `requestTxAttestation(...)` and `recordProof(requestId, proof)` that verifies the proof and emits `AttestationVerified(...)`. (Use later for cross-chain receipts.)

---

# PROMPT 4 — Hardhat config, wallets & env

**Instruction to builder:**
Set up **Hardhat + TypeScript** with networks for **Lisk Sepolia** and **Flare Coston2**. Use `.env` for keys.

* `.env.example`

```
PRIVATE_KEY=0xYOUR_TEST_PRIVATE_KEY
LISK_SEPOLIA_RPC=https://rpc.sepolia-api.lisk.com
FLARE_COSTON2_RPC=https://coston2-api.flare.network/ext/C/rpc
```

* `hardhat.config.ts` (essentials)

```ts
import { config as dotenv } from "dotenv"; dotenv();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PK = process.env.PRIVATE_KEY!;
const config: HardhatUserConfig = {
  solidity: { version: "0.8.27", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    liskSepolia: { url: process.env.LISK_SEPOLIA_RPC!, chainId: 4202, accounts: [PK] },
    coston2:     { url: process.env.FLARE_COSTON2_RPC!, chainId: 114,  accounts: [PK] },
  },
};
export default config;
```

**Wallet setup (dev):**

* Create a fresh EOA, put its **private key** (test-only) in `.env`.
* Fund with test tokens:

  * Lisk Sepolia: request test ETH to pay gas.
  * Flare Coston2: request C2FLR (gas) from faucet.

---

# PROMPT 5 — Tests (COMPLETED - 33 PASSING) ✅

**Comprehensive test suite implemented in `test/` using Hardhat + ethers:**

1. `rfq.commit.reveal.spec.ts` ✅

   * RFQ commit/reveal lifecycle with hash verification
   * Invalid reveals, ownership checks, slippage validation
   * Time window and expiry enforcement

2. `quotes.commit.reveal.spec.ts` ✅

   * Market maker quote commit/reveal process
   * Multi-maker scenarios and commitment validation
   * Time window enforcement and expiry handling

3. `selection.rng.ftso.spec.ts` ✅

   * Quote selection with RNG tie-breaking
   * Slippage filtering against reference prices
   * Secure randomness validation

4. `settlement.vault.spec.ts` ✅

   * Token custody (fund/withdraw)
   * Atomic settlement execution
   * Balance validation and reentrancy protection

**Test coverage:**

* MockERC20 tokens with proper decimals
* Complete RFQ lifecycle integration
* Oracle data integration (FTSO/RNG)
* Error conditions and edge cases

---

# PROMPT 6 — Deployment scripts ✅ DEPLOYED

**Live contracts deployed to testnets:**

* `scripts/deploy-lisk.ts`

  1. Deploy `IntentRegistry` (set `commitWindow`, `revealWindow`).
  2. Deploy `SettlementVault` (set `feeCollector`, `feeBps`).
  3. Deploy `QuoteBook` (inject `intentRegistry`, `settlementVault`, windows, `maxDeviationBps`).
  4. Call a `wire` function on vault/quoteBook if needed (e.g., `setQuoteBook(address)`).
  5. Write addresses to JSON.

* `scripts/deploy-flare.ts`

  1. Deploy `FTSOReader` and `RNGReader`.
  2. (Optional) Deploy `FDCClient`.
  3. Write addresses.

* `scripts/wire-lisk.ts`

  * Any post-deploy setters/roles, e.g., `SettlementVault.setQuoteBook(...)`.

* `scripts/seed-demo.ts`

  * Deploy mock ERC20s, mint to deployer and makers, approve & fund vault.

* `scripts/sanity-check.ts`

  * Read public vars, emit console outputs, exit non-zero if miswired.

**addresses.json format**

```json
{
  "liskSepolia": {
    "IntentRegistry": "0x...",
    "QuoteBook": "0x...",
    "SettlementVault": "0x...",
    "TokenA": "0x...",
    "TokenB": "0x..."
  },
  "coston2": {
    "FTSOReader": "0x...",
    "RNGReader": "0x...",
    "FDCClient": "0x..."
  }
}
```

---

# PROMPT 7 — What each file must contain (acceptance details)

* **IntentRegistry.sol**

  * Enums for `Status`: `None, Committed, Revealed, Cancelled, Expired`.
  * Window checks (`commitWindow`, `revealWindow`) and `expiry`.
  * `onlyOwner(rfqId)` modifier; `whenCommitted/whenRevealOpen` modifiers.
  * Events implemented exactly as specified.

* **QuoteBook.sol**

  * Keeps arrays of quotes per `rfqId`.
  * Validates RFQ state via `IntentRegistry`.
  * `maxDeviationBps` check: compute implied unit price and compare to `refPrice`.
  * Emits `BestSelected` and calls `SettlementVault.fulfill`.

* **SettlementVault.sol**

  * SafeERC20 transfers, non-reentrant.
  * `onlyQuoteBook` gate on `fulfill`.
  * Flexible fee (`feeBps`, `feeCollector`) with setter restricted to owner.

* **FTSOReader.sol**

  * Event + function that returns `(snapshotId, price, timestamp)`.
  * Store `snapshotId++` on each snapshot.

* **RNGReader.sol**

  * Event + function that returns `(value, isSecure, epochTimestamp)`.

* **FDCClient.sol** (optional)

  * Request/verify pattern with events; no business logic beyond proof validation and event surfacing.

* **deploy scripts**

  * Validate `PRIVATE_KEY` and RPCs exist; log chain IDs; write `addresses.json`.

* **tests**

  * Cover happy paths and key reverts; use `increaseTime` helpers.

---

# PROMPT 8 — How to run it (README snippet)

**Instruction to builder:**
Add this to `README.md`.

```
## Quickstart
pnpm install
cp .env.example .env   # add PRIVATE_KEY + RPCs

# Compile & test
pnpm hardhat compile
pnpm hardhat test

# Deploy
pnpm hardhat run scripts/deploy-lisk.ts --network liskSepolia
pnpm hardhat run scripts/deploy-flare.ts --network coston2
pnpm hardhat run scripts/wire-lisk.ts --network liskSepolia
pnpm hardhat run scripts/seed-demo.ts --network liskSepolia
pnpm hardhat run scripts/sanity-check.ts --network liskSepolia

## Demo flow (manual)
1) Call commitRFQ() on Lisk, wait window, then revealRFQ()
2) Makers: commitQuote() then revealQuote()
3) On Flare: call FTSOReader.snapshot() and RNGReader.draw()
4) On Lisk: call selectBest(rfqId, rng.value, rng.isSecure, snapshotId, price)
5) fulfill(rfqId) triggers transfers and emits FillCommitted
```

---

# IMPLEMENTATION STATUS ✅ COMPLETE

## 🎯 All Requirements Implemented

* ✅ **Hash-match verification** in commit/reveal functions
* ✅ **Time window enforcement** with `block.timestamp` 
* ✅ **Slippage filtering** against `refPrice` with `maxSlippageBps`
* ✅ **Secure RNG tie-breaking** (`isSecure == true` required)
* ✅ **ReentrancyGuard + SafeERC20** in SettlementVault
* ✅ **Once-per-RFQ fulfillment** with mapping tracking
* ✅ **Ownable access control** for admin functions

## 🚀 Deployment Status

**Lisk Sepolia (Chain ID: 4202)**
- IntentRegistry: `0x0e645d8C93ded61e0b1C1c1C3d34C6f09F4559CA`
- QuoteBook: `0xd7b8CA6B605e551B1d1cb3ae6c6f42Ca86646609`
- SettlementVault: `0xca5492644C07F3F437F5a73305baF18B8842F323`

**Flare Coston2 (Chain ID: 114)**
- FTSOReader: `0xa0b3B13F05324961E24a87335d69C8CEC57648E2`
- RNGReader: `0xf3578a19ec8fd442e5d017D08731909a753Ad8f8`
- FDCClient: `0xE6B6B03fF579aBBFFa342b64Aa665962b57b2Ea9`

## ✅ Cross-chain RFQ protocol ready for production
