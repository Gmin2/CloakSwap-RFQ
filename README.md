# CloakSwap - Cross-Chain RFQ Protocol

Cross-chain Request for Quote (RFQ) protocol using Lisk L2 for execution and Flare for oracle services.

## 🚀 Quickstart

```bash
pnpm install
cp .env.example .env   # add PRIVATE_KEY + RPCs
pnpm hardhat compile
pnpm hardhat test
```

## 🔧 MetaMask Setup (Required)

### 1. Add Lisk Sepolia Testnet
- **Network Name**: Lisk Sepolia Testnet  
- **RPC URL**: `https://rpc.sepolia-api.lisk.com`
- **Chain ID**: `4202`
- **Currency**: `ETH`
- **Block Explorer**: `https://sepolia-blockscout.lisk.com`

### 2. Add Flare Testnet Coston2  
- **Network Name**: Flare Testnet Coston2
- **RPC URL**: `https://coston2-api.flare.network/ext/C/rpc`
- **Chain ID**: `114`  
- **Currency**: `C2FLR`
- **Block Explorer**: `https://coston2.testnet.flarescan.com`

### 3. Get Testnet Funds
- **Lisk Sepolia ETH**: Use [Lisk Bridge](https://sepolia-bridge.lisk.com) (bridge from Ethereum Sepolia)
- **Ethereum Sepolia ETH**: [SepoliaFaucet.com](https://sepoliafaucet.com/)  
- **Coston2 C2FLR**: [Coston2 Faucet](https://faucet.flare.network/coston2)

### 4. Export Private Key
1. Open MetaMask → Click account → Account Details → Export Private Key
2. Add to `.env` as `PRIVATE_KEY=0x...` (keep the 0x prefix)

## 📦 Deploy Contracts

```bash
# Deploy to testnets
pnpm run deploy:lisk    # Lisk Sepolia  
pnpm run deploy:flare   # Coston2

# Wire contracts together
pnpm run wire:lisk

# Seed demo data
pnpm run seed:lisk

# Run sanity checks
pnpm run sanity:lisk
```

## 🎯 Demo Flow

1. **Create RFQ**: `commitRFQ()` on Lisk → wait → `revealRFQ()`
2. **Market Makers**: `commitQuote()` → wait → `revealQuote()`  
3. **Oracle Data**: `FTSOReader.snapshot()` + `RNGReader.draw()` on Flare
4. **Selection**: `selectBest(rfqId, rng, price)` on Lisk
5. **Settlement**: `fulfill(rfqId)` triggers atomic swap

## 🏗️ Architecture

**Lisk Contracts (L2 Execution)**:
- `IntentRegistry`: RFQ lifecycle management
- `QuoteBook`: Market maker quotes + randomized selection
- `SettlementVault`: Token custody + atomic swaps

**Flare Contracts (Oracle Layer)**:  
- `FTSOReader`: Price feed snapshots
- `RNGReader`: Secure randomness  
- `FDCClient`: External data attestation