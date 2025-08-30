import { cfg } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TokenInfo {
  symbol: string;
  decimals: number;
  address: string;
  oracleSymbol: string; // What symbol to use for Flare oracle
}

class TokenMapping {
  private addressToToken = new Map<string, TokenInfo>();
  private symbolToToken = new Map<string, TokenInfo>();

  constructor() {
    this.loadTokens();
  }

  private loadTokens() {
    // Load deployed token addresses
    const configPath = path.join(__dirname, '../../deploy-config/addresses.json');
    if (fs.existsSync(configPath)) {
      const deployConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      // TokenA = Mock USDC (6 decimals)
      if (deployConfig.liskSepolia?.TokenA) {
        this.addToken({
          symbol: 'USDC',
          decimals: 6,
          address: deployConfig.liskSepolia.TokenA,
          oracleSymbol: 'USDC' // $1 stable
        });
      }
      
      // TokenB = Mock WETH (18 decimals) 
      if (deployConfig.liskSepolia?.TokenB) {
        this.addToken({
          symbol: 'WETH',
          decimals: 18,
          address: deployConfig.liskSepolia.TokenB,
          oracleSymbol: 'ETH' // Use ETH oracle for WETH
        });
      }
    }

    // Add native ETH support (zero address)
    this.addToken({
      symbol: 'ETH',
      decimals: 18,
      address: '0x0000000000000000000000000000000000000000',
      oracleSymbol: 'ETH'
    });
  }

  private addToken(token: TokenInfo) {
    this.addressToToken.set(token.address.toLowerCase(), token);
    this.symbolToToken.set(token.symbol, token);
  }

  getTokenByAddress(address: string): TokenInfo | undefined {
    return this.addressToToken.get(address.toLowerCase());
  }

  getTokenBySymbol(symbol: string): TokenInfo | undefined {
    return this.symbolToToken.get(symbol);
  }

  getSupportedTokens(): TokenInfo[] {
    return Array.from(this.symbolToToken.values());
  }

  isSupported(address: string): boolean {
    return this.addressToToken.has(address.toLowerCase());
  }

  // Check if we can make markets for this token pair
  canMakeMarket(tokenInAddress: string, tokenOutAddress: string): boolean {
    return this.isSupported(tokenInAddress) && this.isSupported(tokenOutAddress);
  }
}

export const tokenMapping = new TokenMapping();