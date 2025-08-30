import { log } from './logger.js';

export async function mockSnapshot(symbol: string = 'ETH/USD') {
  log('info', `Using mock FTSO snapshot for ${symbol}...`);
  
  // Mock price data (ETH/USD = $2500)
  const mockData = {
    snapshotId: Math.floor(Date.now() / 1000), // Use timestamp as ID
    price: BigInt('250000000000'), // $2500 with 8 decimals
    timestamp: Math.floor(Date.now() / 1000),
    txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  };
  
  log('success', 'Mock FTSO snapshot created', mockData);
  return mockData;
}

export async function mockRng() {
  log('info', 'Using mock secure RNG...');
  
  // Mock secure randomness
  const mockData = {
    value: BigInt(Math.floor(Math.random() * 1000000)),
    isSecure: true,
    epochTimestamp: Math.floor(Date.now() / 1000),
    txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  };
  
  log('success', 'Mock RNG drawn', mockData);
  return mockData;
}