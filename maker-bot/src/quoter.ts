import { liskWal, liskPub } from './clients.js';
import { QUOTE_BOOK_ABI } from './abis.js';
import { cfg } from './config.js';
import { log, explorerLink } from './logger.js';
import { PricingEngine } from './pricing.js';
import { keccak256, encodePacked, parseUnits, formatUnits } from 'viem';

export interface QuoteParams {
  rfqId: bigint;
  quoteOut: bigint;
}

export class Quoter {
  private pricing: PricingEngine;
  private activeQuotes = new Map<bigint, { salt: bigint; quote: bigint; timestamp: number }>();

  constructor() {
    this.pricing = new PricingEngine();
  }

  async submitQuote(params: QuoteParams): Promise<boolean> {
    try {
      // Generate random salt for commit
      const salt = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
      
      // Create commitment hash (quoteOut + salt)
      const commitment = keccak256(
        encodePacked(
          ['uint256', 'uint256'],
          [params.quoteOut, salt]
        )
      );

      log('info', `Submitting commit for RFQ ${params.rfqId}`, {
        quote: formatUnits(params.quoteOut, 18),
        commitment: commitment.slice(0, 10) + '...'
      });

      // Submit commit
      const commitTx = await liskWal.writeContract({
        address: cfg.quoteBook as `0x${string}`,
        abi: QUOTE_BOOK_ABI,
        functionName: 'commitQuote',
        args: [params.rfqId, commitment]
      });

      log('success', `Commit submitted: ${explorerLink(commitTx)}`);

      // Store quote details for reveal phase
      this.activeQuotes.set(params.rfqId, {
        salt,
        quote: params.quoteOut,
        timestamp: Date.now()
      });

      // Schedule reveal (typically after commit period ends)
      setTimeout(() => {
        this.revealQuote(params.rfqId).catch(error => 
          log('error', `Failed to reveal quote for RFQ ${params.rfqId}`, error)
        );
      }, 60000); // 1 minute delay for reveal

      return true;
    } catch (error) {
      log('error', `Failed to submit quote for RFQ ${params.rfqId}`, error);
      return false;
    }
  }

  private async revealQuote(rfqId: bigint): Promise<void> {
    const quoteData = this.activeQuotes.get(rfqId);
    if (!quoteData) {
      log('error', `No quote data found for RFQ ${rfqId}`);
      return;
    }

    try {
      log('info', `Revealing quote for RFQ ${rfqId}`, {
        quote: formatUnits(quoteData.quote, 18),
        salt: quoteData.salt.toString()
      });

      const revealTx = await liskWal.writeContract({
        address: cfg.quoteBook as `0x${string}`,
        abi: QUOTE_BOOK_ABI,
        functionName: 'revealQuote',
        args: [rfqId, quoteData.quote, quoteData.salt]
      });

      log('success', `Reveal submitted: ${explorerLink(revealTx)}`);
      
      // Clean up stored quote
      this.activeQuotes.delete(rfqId);
    } catch (error) {
      log('error', `Failed to reveal quote for RFQ ${rfqId}`, error);
    }
  }

  async getQuoteStatus(rfqId: bigint): Promise<any> {
    try {
      const status = await liskPub.readContract({
        address: cfg.quoteBook as `0x${string}`,
        abi: QUOTE_BOOK_ABI,
        functionName: 'getQuote',
        args: [rfqId]
      });
      return status;
    } catch (error) {
      log('error', `Failed to get quote status for RFQ ${rfqId}`, error);
      return null;
    }
  }

  getPendingQuotes(): Map<bigint, any> {
    return new Map(this.activeQuotes);
  }
}