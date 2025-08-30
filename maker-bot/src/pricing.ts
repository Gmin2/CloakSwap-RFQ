import { flarePub, flareWal, account } from './clients.js';
import { FTSO_READER_ABI } from './abis.js';
import { cfg } from './config.js';
import { log } from './logger.js';
import { tokenMapping, TokenInfo } from './tokens.js';

export interface PriceData {
  price: bigint;
  timestamp: number;
  decimals: number;
}

export class PricingEngine {
  private priceCache = new Map<string, { data: PriceData; expiry: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  
  // Feed IDs for common trading pairs on Flare FTSO
  private readonly FEED_IDS: Record<string, string> = {
    'ETH': '0x014554482f55534400000000000000000000000000', // ETH/USD
    'USDC': '0x015553444320555344000000000000000000000000', // USDC/USD (dummy - assume $1)
  };

  async getPriceByAddress(tokenAddress: string): Promise<PriceData> {
    const token = tokenMapping.getTokenByAddress(tokenAddress);
    if (!token) {
      throw new Error(`Token not supported: ${tokenAddress}`);
    }
    return this.getPriceBySymbol(token.oracleSymbol);
  }

  async getPriceBySymbol(symbol: string): Promise<PriceData> {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }

    const priceData = await this.fetchPrice(symbol);
    this.priceCache.set(symbol, {
      data: priceData,
      expiry: Date.now() + this.CACHE_DURATION
    });

    return priceData;
  }

  private async fetchPrice(symbol: string): Promise<PriceData> {
    try {
      // For USDC, we'll assume $1 for simplicity
      if (symbol === 'USDC') {
        return {
          price: 100000000n, // $1 with 8 decimals
          timestamp: Math.floor(Date.now() / 1000),
          decimals: 8
        };
      }

      const feedId = this.FEED_IDS[symbol];
      if (!feedId) {
        throw new Error(`No feed ID configured for symbol: ${symbol}`);
      }

      const { result } = await flarePub.simulateContract({
        address: cfg.ftsoReader as `0x${string}`,
        abi: FTSO_READER_ABI,
        functionName: 'getCurrentPrice',
        args: [feedId as `0x${string}`],
        value: 1000000000000000n, // 0.001 ETH for FTSO fee
        account
      });

      const [price, decimals, timestamp] = result as [bigint, number, bigint];
      
      log('info', `Fetched ${symbol} price: ${price} (${decimals} decimals) at ${timestamp}`);
      
      return {
        price,
        timestamp: Number(timestamp),
        decimals: Math.abs(Number(decimals)) // Handle negative decimals
      };
    } catch (error) {
      log('error', `Failed to fetch price for ${symbol}`, error);
      throw new Error(`Failed to fetch price for ${symbol}`);
    }
  }

  async calculateQuotePrice(
    tokenFromAddress: string,
    tokenToAddress: string,
    amountFrom: bigint,
    isCommit: boolean = false
  ): Promise<bigint> {
    // Get token info for decimal handling
    const tokenFrom = tokenMapping.getTokenByAddress(tokenFromAddress);
    const tokenTo = tokenMapping.getTokenByAddress(tokenToAddress);
    
    if (!tokenFrom || !tokenTo) {
      throw new Error(`Unsupported token pair: ${tokenFromAddress} -> ${tokenToAddress}`);
    }

    // Get oracle prices
    const priceFrom = await this.getPriceBySymbol(tokenFrom.oracleSymbol);
    const priceTo = await this.getPriceBySymbol(tokenTo.oracleSymbol);

    // Calculate exchange rate with proper decimal handling
    // Price is in USD with oracle decimals, need to convert to token amounts
    
    // Convert amountFrom to USD value (accounting for token decimals)
    const amountFromInUsd = (amountFrom * priceFrom.price) / (10n ** BigInt(tokenFrom.decimals + priceFrom.decimals));
    
    // Convert USD value to amountTo (accounting for token decimals)  
    let amountTo = (amountFromInUsd * (10n ** BigInt(tokenTo.decimals + priceTo.decimals))) / priceTo.price;

    // Apply spread for profit
    const spreadMultiplier = 10000n - BigInt(cfg.spreadBps);
    amountTo = (amountTo * spreadMultiplier) / 10000n;

    // For commit phase, apply additional slippage protection
    if (isCommit) {
      const slippageMultiplier = 10000n - BigInt(cfg.slippageToleranceBps);
      amountTo = (amountTo * slippageMultiplier) / 10000n;
    }

    return amountTo;
  }

  async estimateProfit(
    tokenFromAddress: string,
    tokenToAddress: string, 
    amountFrom: bigint,
    requestedAmountTo: bigint
  ): Promise<bigint> {
    const ourQuote = await this.calculateQuotePrice(tokenFromAddress, tokenToAddress, amountFrom);
    
    // Profit is the difference between what they want and what we offer
    // Positive means we profit
    return ourQuote - requestedAmountTo;
  }

  async isProfitable(
    tokenFromAddress: string,
    tokenToAddress: string,
    amountFrom: bigint,
    requestedAmountTo: bigint
  ): Promise<boolean> {
    const profit = await this.estimateProfit(tokenFromAddress, tokenToAddress, amountFrom, requestedAmountTo);
    const minProfit = (requestedAmountTo * BigInt(cfg.minProfitBps)) / 10000n;
    return profit >= minProfit;
  }
}