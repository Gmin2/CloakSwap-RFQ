import { config as dotenv } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv();

const configSchema = z.object({
  privateKey: z.string().startsWith('0x'),
  liskRpc: z.string().url(),
  flareRpc: z.string().url(),
  intentRegistry: z.string().startsWith('0x'),
  quoteBook: z.string().startsWith('0x'),
  settlementVault: z.string().startsWith('0x'),
  ftsoReader: z.string().startsWith('0x'),
  chainIdLisk: z.number().default(4202),
  chainIdFlare: z.number().default(114),
  // Trading parameters
  minProfitBps: z.number().default(25),
  maxPositionSize: z.number().default(1000),
  spreadBps: z.number().default(100),
  slippageToleranceBps: z.number().default(200),
});

function loadConfig() {
  // Load from deploy-config if addresses not in env
  const configPath = path.join(__dirname, '../../deploy-config/addresses.json');
  let deployedAddresses: any = {};
  
  if (fs.existsSync(configPath)) {
    deployedAddresses = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  return configSchema.parse({
    privateKey: process.env.PRIVATE_KEY!,
    liskRpc: process.env.LISK_RPC!,
    flareRpc: process.env.FLARE_RPC!,
    intentRegistry: process.env.INTENT_REGISTRY || deployedAddresses.liskSepolia?.IntentRegistry,
    quoteBook: process.env.QUOTE_BOOK || deployedAddresses.liskSepolia?.QuoteBook,
    settlementVault: process.env.SETTLEMENT_VAULT || deployedAddresses.liskSepolia?.SettlementVault,
    ftsoReader: process.env.FTSO_READER || deployedAddresses.coston2?.FTSOReader,
    chainIdLisk: parseInt(process.env.CHAIN_ID_LISK || '4202'),
    chainIdFlare: parseInt(process.env.CHAIN_ID_FLARE || '114'),
    minProfitBps: parseInt(process.env.MIN_PROFIT_BPS || '25'),
    maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE || '1000'),
    spreadBps: parseInt(process.env.SPREAD_BPS || '100'),
    slippageToleranceBps: parseInt(process.env.SLIPPAGE_TOLERANCE_BPS || '200'),
  });
}

export const cfg = loadConfig();
export type Config = typeof cfg;