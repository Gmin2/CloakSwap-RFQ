import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Selecting best quote with oracle data...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { QuoteBook } = config.liskSepolia;
  
  const [deployer] = await ethers.getSigners();
  console.log('Selecting with account:', deployer.address);
  
  const quoteBook = await ethers.getContractAt('QuoteBook', QuoteBook);
  
  // Mock oracle data (in real implementation, get from Flare contracts)
  const rngValue = 42; // Mock random number
  const isSecure = true; // Mock secure flag
  const snapshotId = 1; // Mock FTSO snapshot ID
  const refPrice = ethers.parseEther('100'); // 1:1 reference price
  
  console.log('\nOracle data:');
  console.log('RNG Value:', rngValue);
  console.log('RNG Secure:', isSecure);
  console.log('Snapshot ID:', snapshotId);
  console.log('Reference Price:', ethers.formatEther(refPrice));
  
  const tx = await quoteBook.selectBest(1, rngValue, isSecure, snapshotId, refPrice);
  const receipt = await tx.wait();
  
  console.log('\n✅ Best quote selected!');
  console.log('Transaction hash:', receipt?.hash);
  
  // Get selected quote
  const selectedQuote = await quoteBook.getSelectedQuote(1);
  console.log('\nSelected quote:');
  console.log('Maker:', selectedQuote.maker);
  console.log('Quote Out:', ethers.formatEther(selectedQuote.quoteOut));
  
  console.log('\n💰 Next step: Fund vault and execute settlement');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});