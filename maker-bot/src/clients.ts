import { createPublicClient, createWalletClient, http, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { cfg } from './config.js';

export const liskSepolia = defineChain({
  id: cfg.chainIdLisk,
  name: 'Lisk Sepolia',
  network: 'lisk-sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [cfg.liskRpc] } },
  blockExplorers: { 
    default: { name: 'Blockscout', url: 'https://sepolia-blockscout.lisk.com' } 
  },
});

export const coston2 = defineChain({
  id: cfg.chainIdFlare,
  name: 'Flare Coston2',
  network: 'coston2',
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: { default: { http: [cfg.flareRpc] } },
  blockExplorers: { 
    default: { name: 'Flarescan', url: 'https://coston2.testnet.flarescan.com' } 
  },
});

const account = privateKeyToAccount(cfg.privateKey as `0x${string}`);

export const liskPub = createPublicClient({ 
  chain: liskSepolia, 
  transport: http() 
}) as any;

export const liskWal = createWalletClient({ 
  chain: liskSepolia, 
  transport: http(), 
  account 
}) as any;

export const flarePub = createPublicClient({ 
  chain: coston2, 
  transport: http() 
}) as any;

export const flareWal = createWalletClient({ 
  chain: coston2, 
  transport: http(), 
  account 
}) as any;

export { account };