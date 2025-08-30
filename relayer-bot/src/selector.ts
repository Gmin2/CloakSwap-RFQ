import { decodeEventLog } from 'viem';
import { liskWal, liskPub } from './clients.js';
import { QUOTE_BOOK_ABI } from './abis.js';
import { cfg } from './config.js';
import { log, explorerLink } from './logger.js';
import { takeSnapshot } from './ftso.js';
import { drawRng } from './rng.js';
import { mockSnapshot, mockRng } from './mock-oracle.js';

export async function selectBestQuote(rfqId: number, symbol?: string) {
  log('info', `Selecting best quote for RFQ ${rfqId}...`);
  
  try {
    // Step 1: Take FTSO snapshot on Flare (real oracle data)
    const snapshot = await takeSnapshot(symbol);
    
    // Step 2: Draw secure RNG on Flare (real randomness)
    const rng = await drawRng();
    
    // Step 3: Validate RNG is secure
    if (!rng.isSecure) {
      throw new Error('RNG is not secure - cannot proceed with selection');
    }
    
    log('info', 'Oracle data ready', {
      snapshotId: snapshot.snapshotId,
      price: snapshot.price.toString(),
      rngValue: rng.value.toString(),
      isSecure: rng.isSecure,
    });
    
    // Step 4: Call selectBest on Lisk
    const hash = await liskWal.writeContract({
      address: cfg.quoteBook as `0x${string}`,
      abi: QUOTE_BOOK_ABI,
      functionName: 'selectBest',
      args: [
        BigInt(rfqId),
        rng.value,
        rng.isSecure,
        BigInt(snapshot.snapshotId),
        snapshot.price
      ],
      account: liskWal.account,
      chain: liskWal.chain,
    });
    
    log('success', `Quote selection submitted: ${explorerLink(hash, 'lisk')}`);
    
    // Wait for receipt and parse BestQuoteSelected event
    const receipt = await liskPub.waitForTransactionReceipt({ hash });
    
    const logs = await liskPub.getLogs({
      address: cfg.quoteBook as `0x${string}`,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    
    const decodedLogs = logs.map((log: any) =>
      decodeEventLog({
        abi: QUOTE_BOOK_ABI,
        data: log.data,
        topics: log.topics,
      })
    );
    
    const selectionEvent = decodedLogs.find((log: any) => log.eventName === 'BestQuoteSelected');
    
    if (selectionEvent) {
      const args = (selectionEvent as any).args;
      
      log('success', 'Best quote selected!', {
        rfqId: rfqId,
        maker: args?.maker || 'N/A',
        quoteOut: args?.quoteOut?.toString() || 'N/A',
        winnerIndex: args?.winnerIndex?.toString() || 'N/A',
        liskTx: explorerLink(hash, 'lisk'),
        flareFtsoTx: explorerLink(snapshot.txHash, 'flare'),
        flareRngTx: explorerLink(rng.txHash, 'flare'),
      });
      
      return {
        rfqId: rfqId,
        maker: args?.maker || 'N/A',
        quoteOut: args?.quoteOut || 0n,
        winnerIndex: args?.winnerIndex || 0,
        transactions: {
          lisk: hash,
          flareFtso: snapshot.txHash,
          flareRng: rng.txHash,
        }
      };
    }
    
    throw new Error('BestQuoteSelected event not found');
    
  } catch (error) {
    console.error('Full error details:', error);
    log('error', `Failed to select best quote for RFQ ${rfqId}`, {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Unknown',
      stack: error?.stack || 'No stack',
    });
    throw error;
  }
}