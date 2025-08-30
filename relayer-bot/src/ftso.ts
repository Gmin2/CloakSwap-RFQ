import { stringToHex, padHex, decodeEventLog } from 'viem';
import { flareWal, flarePub } from './clients.js';
import { FTSO_READER_ABI } from './abis.js';
import { cfg } from './config.js';
import { log, explorerLink } from './logger.js';

export async function takeSnapshot(symbol: string = cfg.symbol) {
  log('info', `Taking FTSO snapshot for ${symbol}...`);
  
  // Convert symbol to bytes21 (right-padded)
  const symbol21 = padHex(stringToHex(symbol), { size: 21 });
  
  try {
    const hash = await flareWal.writeContract({
      address: cfg.ftsoReader as `0x${string}`,
      abi: FTSO_READER_ABI,
      functionName: 'snapshot',
      args: [symbol21],
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
    
    const snapshotEvent = decodedLogs.find((log: any) => log.eventName === 'PriceSnapshotted');
    
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