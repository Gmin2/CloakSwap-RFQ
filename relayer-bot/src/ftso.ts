import { stringToHex, padHex, decodeEventLog } from 'viem';
import { flareWal, flarePub } from './clients.js';
import { FTSO_READER_ABI } from './abis.js';
import { cfg } from './config.js';
import { log, explorerLink } from './logger.js';

// Valid FTSO feed IDs on Coston2 (bytes21 format)
const FEED_IDS = {
  'FLR/USD': '0x01464c522f55534400000000000000000000000000',
  'BTC/USD': '0x014254432f55534400000000000000000000000000', 
  'ETH/USD': '0x014554482f55534400000000000000000000000000',
  'XRP/USD': '0x015852502f55534400000000000000000000000000',
  'ADA/USD': '0x014144412f55534400000000000000000000000000',
} as const;

export async function takeSnapshot(symbol: string = cfg.symbol) {
  log('info', `Taking FTSO snapshot for ${symbol}...`);
  
  // Use predefined feed ID or fallback to FLR/USD
  const feedId = FEED_IDS[symbol as keyof typeof FEED_IDS] || FEED_IDS['FLR/USD'];
  log('info', `Using feed ID: ${feedId} for ${symbol}`);
  
  try {
    const hash = await flareWal.writeContract({
      address: cfg.ftsoReader as `0x${string}`,
      abi: FTSO_READER_ABI,
      functionName: 'snapshot',
      args: [feedId as `0x${string}`],
      account: flareWal.account,
      chain: flareWal.chain,
    });
    
    log('success', `FTSO snapshot submitted: ${explorerLink(hash, 'flare')}`);
    
    // Wait for receipt
    const receipt = await flarePub.waitForTransactionReceipt({ hash });
    
    // Parse logs for PriceSnapshotted event
    const logs = await flarePub.getLogs({
      address: cfg.ftsoReader as `0x${string}`,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    
    // Decode the event
    const decodedLogs = logs.map((log: any) =>
      decodeEventLog({
        abi: FTSO_READER_ABI,
        data: log.data,
        topics: log.topics,
      })
    );
    
    const snapshotEvent = decodedLogs.find((log: any) => log.eventName === 'PriceSnapshotTaken');
    
    if (snapshotEvent) {
      const { snapshotId, feedId, price, timestamp } = (snapshotEvent as any).args;
      
      log('success', 'FTSO snapshot created', {
        snapshotId: snapshotId.toString(),
        feedId,
        price: price.toString(),
        timestamp: timestamp.toString(),
        txHash: hash,
      });
      
      return {
        snapshotId: Number(snapshotId),
        price: BigInt(price),
        timestamp: Number(timestamp),
        txHash: hash,
      };
    }
    
    throw new Error('PriceSnapshotted event not found');
    
  } catch (error) {
    log('error', 'Failed to take FTSO snapshot', error);
    throw error;
  }
}