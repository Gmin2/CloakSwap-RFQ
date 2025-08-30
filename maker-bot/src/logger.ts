export function log(level: 'info' | 'error' | 'success' | 'warn', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'success' ? '✅' : level === 'warn' ? '⚠️' : 'ℹ️';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
  if (data) {
    // Handle BigInt serialization
    console.log(JSON.stringify(data, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2
    ));
  }
}

export function explorerLink(txHash: string): string {
  return `https://sepolia-blockscout.lisk.com/tx/${txHash}`;
}