import { liskPub } from './clients.js';
import { INTENT_REGISTRY_ABI } from './abis.js';
import { cfg } from './config.js';
import { log } from './logger.js';
import { tokenMapping } from './tokens.js';
import { PricingEngine } from './pricing.js';

export interface RFQEvent {
  rfqId: bigint;
  amountIn: bigint;
  maxSlippageBps: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

export class RFQMonitor {
  private lastProcessedBlock: bigint | null = null;
  private pricing: PricingEngine;
  private onNewRFQ: ((rfq: RFQEvent, rfqDetails: any) => void) | null = null;

  constructor() {
    this.pricing = new PricingEngine();
  }

  setRFQHandler(handler: (rfq: RFQEvent, rfqDetails: any) => void) {
    this.onNewRFQ = handler;
  }

  async startMonitoring() {
    log('info', 'Starting RFQ monitoring...');
    
    // Get current block as starting point
    this.lastProcessedBlock = await liskPub.getBlockNumber();
    log('info', `Starting from block: ${this.lastProcessedBlock}`);

    // Poll for new events every 5 seconds
    setInterval(async () => {
      try {
        await this.checkForNewRFQs();
      } catch (error) {
        log('error', 'Error checking for new RFQs', error);
      }
    }, 5000);
  }

  private async checkForNewRFQs() {
    const currentBlock = await liskPub.getBlockNumber();
    
    if (!this.lastProcessedBlock || currentBlock <= this.lastProcessedBlock) {
      return;
    }

    // Get RFQRevealed events from last processed block to current
    const events = await liskPub.getLogs({
      address: cfg.intentRegistry as `0x${string}`,
      event: {
        type: 'event',
        name: 'RFQRevealed',
        inputs: [
          { name: 'rfqId', type: 'uint256', indexed: true },
          { name: 'amountIn', type: 'uint256', indexed: false },
          { name: 'maxSlippageBps', type: 'uint256', indexed: false }
        ]
      },
      fromBlock: this.lastProcessedBlock + 1n,
      toBlock: currentBlock
    });

    for (const event of events) {
      const rfqEvent: RFQEvent = {
        rfqId: event.args.rfqId as bigint,
        amountIn: event.args.amountIn as bigint,
        maxSlippageBps: event.args.maxSlippageBps as bigint,
        blockNumber: event.blockNumber!,
        transactionHash: event.transactionHash!
      };

      await this.processRFQ(rfqEvent);
    }

    this.lastProcessedBlock = currentBlock;
  }

  private async processRFQ(rfq: RFQEvent) {
    log('info', `New RFQ detected: ${rfq.rfqId}`, {
      amountIn: rfq.amountIn.toString(),
      maxSlippageBps: rfq.maxSlippageBps.toString(),
      txHash: rfq.transactionHash
    });

    // Get full RFQ details from contract to see token addresses
    try {
      const fullRFQ = await liskPub.readContract({
        address: cfg.intentRegistry as `0x${string}`,
        abi: INTENT_REGISTRY_ABI,
        functionName: 'getRFQ',
        args: [rfq.rfqId]
      }) as any;

      log('info', `RFQ details`, {
        owner: fullRFQ.owner,
        tokenIn: fullRFQ.tokenIn,
        tokenOut: fullRFQ.tokenOut,
        expiry: fullRFQ.expiry.toString()
      });

      // Check if we want to quote on this RFQ
      if (this.shouldQuoteOnRFQ(rfq, fullRFQ)) {
        log('info', `RFQ ${rfq.rfqId} is suitable for market making`);
        
        // Notify handler (maker bot) about new RFQ opportunity
        if (this.onNewRFQ) {
          this.onNewRFQ(rfq, fullRFQ);
        }
      } else {
        log('info', `Skipping RFQ ${rfq.rfqId} - not profitable or supported`);
      }
    } catch (error) {
      log('error', `Failed to get RFQ details for ${rfq.rfqId}`, error);
    }
  }

  private shouldQuoteOnRFQ(rfq: RFQEvent, fullRFQ: any): boolean {
    // Check if we support this token pair
    if (!tokenMapping.canMakeMarket(fullRFQ.tokenIn, fullRFQ.tokenOut)) {
      log('info', `Unsupported token pair: ${fullRFQ.tokenIn} -> ${fullRFQ.tokenOut}`);
      return false;
    }

    // Check if amounts are within our position limits  
    if (rfq.amountIn > BigInt(cfg.maxPositionSize) * 10n**18n) {
      log('info', `RFQ amount too large: ${rfq.amountIn.toString()}`);
      return false;
    }

    // Check if not expired
    if (Number(fullRFQ.expiry) <= Math.floor(Date.now() / 1000)) {
      log('info', `RFQ expired: ${fullRFQ.expiry}`);
      return false;
    }

    // Check if RFQ status is revealed (status = 2)
    if (Number(fullRFQ.status) !== 2) {
      log('info', `RFQ not in revealed state: ${fullRFQ.status}`);
      return false;
    }

    return true;
  }
}