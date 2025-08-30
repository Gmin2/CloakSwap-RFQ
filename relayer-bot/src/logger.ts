export function log(level: 'info' | 'error' | 'success', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    // Handle BigInt serialization
    console.log(JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2
    ));
  }
}

export function explorerLink(txHash: string, chain: 'lisk' | 'flare'): string {
  if (chain === 'lisk') {
    return `https://sepolia-blockscout.lisk.com/tx/${txHash}`;
  }
  return `https://coston2.testnet.flarescan.com/tx/${txHash}`;
}