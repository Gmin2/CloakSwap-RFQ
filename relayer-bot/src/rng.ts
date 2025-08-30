import { decodeEventLog } from 'viem';
import { flareWal, flarePub } from './clients.js';
import { RNG_READER_ABI } from './abis.js';
import { cfg } from './config.js';
import { log, explorerLink } from './logger.js';

export async function drawRng() {
  log('info', 'Drawing secure random number...');
  
  try {
    const hash = await flareWal.writeContract({
      address: cfg.rngReader as `0x${string}`,
      abi: RNG_READER_ABI,
      functionName: 'draw',
      args: [],
      account: flareWal.account,
      chain: flareWal.chain,
    });
    
    log('success', `RNG draw submitted: ${explorerLink(hash, 'flare')}`);
    
    // Wait for receipt
    const receipt = await flarePub.waitForTransactionReceipt({ hash });
    
    // Parse logs for RngDrawn event
    const logs = await flarePub.getLogs({
      address: cfg.rngReader as `0x${string}`,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });
    
    const decodedLogs = logs.map((log: any) =>
      decodeEventLog({
        abi: RNG_READER_ABI,
        data: log.data,
        topics: log.topics,
      })
    );
    
    const rngEvent = decodedLogs.find((log: any) => log.eventName === 'RandomDrawTaken');
    
    if (rngEvent) {
      const { randomNumber, isSecure, timestamp } = (rngEvent as any).args;
      
      log('success', 'RNG drawn', {
        value: randomNumber.toString(),
        isSecure,
        timestamp: timestamp.toString(),
        txHash: hash,
      });
      
      return {
        value: BigInt(randomNumber),
        isSecure: Boolean(isSecure),
        epochTimestamp: Number(timestamp),
        txHash: hash,
      };
    }
    
    throw new Error('RandomDrawTaken event not found');
    
  } catch (error) {
    log('error', 'Failed to draw RNG', error);
    throw error;
  }
}