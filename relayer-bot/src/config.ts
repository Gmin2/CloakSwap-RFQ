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
  quoteBook: z.string().startsWith('0x'),
  ftsoReader: z.string().startsWith('0x'),
  rngReader: z.string().startsWith('0x'),
  symbol: z.string().default('ETH/USD'),
  chainIdLisk: z.number().default(4202),
  chainIdFlare: z.number().default(114),
  maxDeviationBps: z.number().default(300),
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
    quoteBook: process.env.QUOTE_BOOK || deployedAddresses.liskSepolia?.QuoteBook,
    ftsoReader: process.env.FTSO_READER || deployedAddresses.coston2?.FTSOReader,
    rngReader: process.env.RNG_READER || deployedAddresses.coston2?.RNGReader,
    symbol: process.env.SYMBOL || 'ETH/USD',
    chainIdLisk: parseInt(process.env.CHAIN_ID_LISK || '4202'),
    chainIdFlare: parseInt(process.env.CHAIN_ID_FLARE || '114'),
    maxDeviationBps: parseInt(process.env.MAX_DEVIATION_BPS || '300'),
  });
}

export const cfg = loadConfig();
export type Config = typeof cfg;