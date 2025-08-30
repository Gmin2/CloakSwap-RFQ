import { RFQMonitor, RFQEvent } from './monitor.js';
import { Quoter } from './quoter.js';
import { PricingEngine } from './pricing.js';
import { log } from './logger.js';
import { cfg } from './config.js';
import { tokenMapping } from './tokens.js';

export class MakerBot {
  private monitor: RFQMonitor;
  private quoter: Quoter;
  private pricing: PricingEngine;
  private isRunning = false;

  constructor() {
    this.monitor = new RFQMonitor();
    this.quoter = new Quoter();
    this.pricing = new PricingEngine();
  }

  async start() {
    if (this.isRunning) {
      log('warn', 'Maker bot is already running');
      return;
    }

    log('info', 'Starting CloakSwap Maker Bot...', {
      intentRegistry: cfg.intentRegistry,
      quoteBook: cfg.quoteBook,
      minProfitBps: cfg.minProfitBps,
      spreadBps: cfg.spreadBps
    });

    this.isRunning = true;

    // Set up RFQ handler before starting monitoring
    this.monitor.setRFQHandler((rfq: RFQEvent, rfqDetails: any) => {
      this.handleNewRFQ(rfq, rfqDetails);
    });

    // Start monitoring for RFQs
    await this.monitor.startMonitoring();

    log('success', 'Maker bot started successfully');
  }

  private async handleNewRFQ(rfq: RFQEvent, rfqDetails: any) {
    try {
      const tokenFrom = tokenMapping.getTokenByAddress(rfqDetails.tokenIn);
      const tokenTo = tokenMapping.getTokenByAddress(rfqDetails.tokenOut);
      
      log('info', `Processing RFQ ${rfq.rfqId}: ${tokenFrom?.symbol} -> ${tokenTo?.symbol}`, {
        amountIn: rfq.amountIn.toString(),
        maxSlippageBps: rfq.maxSlippageBps.toString(),
        tokenIn: rfqDetails.tokenIn,
        tokenOut: rfqDetails.tokenOut
      });

      // Calculate our competitive quote
      const ourQuote = await this.pricing.calculateQuotePrice(
        rfqDetails.tokenIn,
        rfqDetails.tokenOut,
        rfq.amountIn,
        true // use commit-phase safety margin
      );

      // Check if this would be profitable for us
      // Note: We don't have their target amount, so we estimate based on oracle price
      const fairValue = await this.pricing.calculateQuotePrice(
        rfqDetails.tokenIn,
        rfqDetails.tokenOut,
        rfq.amountIn,
        false // no safety margin for fair value
      );

      log('info', `Quote calculation for RFQ ${rfq.rfqId}`, {
        ourQuote: ourQuote.toString(),
        fairValue: fairValue.toString(),
        spread: `${cfg.spreadBps}bps`
      });

      // Submit our quote
      const success = await this.quoter.submitQuote({
        rfqId: rfq.rfqId,
        quoteOut: ourQuote
      });

      if (success) {
        log('success', `Successfully submitted quote for RFQ ${rfq.rfqId}`);
      } else {
        log('error', `Failed to submit quote for RFQ ${rfq.rfqId}`);
      }

    } catch (error) {
      log('error', `Error handling RFQ ${rfq.rfqId}`, error);
    }
  }

  async getStatus() {
    const pendingQuotes = this.quoter.getPendingQuotes();
    
    log('info', 'Maker Bot Status', {
      running: this.isRunning,
      pendingQuotes: pendingQuotes.size,
      config: {
        minProfitBps: cfg.minProfitBps,
        spreadBps: cfg.spreadBps,
        maxPositionSize: cfg.maxPositionSize
      }
    });

    return {
      running: this.isRunning,
      pendingQuotes: Array.from(pendingQuotes.entries()),
      config: cfg
    };
  }

  stop() {
    this.isRunning = false;
    log('info', 'Maker bot stopped');
  }
}