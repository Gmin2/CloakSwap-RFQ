import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Revealing demo RFQ...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { IntentRegistry } = config.liskSepolia;
  
  const demoDataPath = path.join(__dirname, '../deploy-config/demo-data.json');
  const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
  
  const [deployer] = await ethers.getSigners();
  console.log('Revealing with account:', deployer.address);
  
  const intentRegistry = await ethers.getContractAt('IntentRegistry', IntentRegistry);
  
  console.log('\nRevealing RFQ ID:', demoData.rfqId);
  console.log('Amount In:', ethers.formatEther(demoData.amountIn), 'tokens');
  console.log('Max Slippage:', demoData.maxSlippageBps / 100, '%');
  console.log('Salt:', demoData.salt);
  
  const tx = await intentRegistry.revealRFQ(
    demoData.rfqId,
    demoData.amountIn,
    demoData.maxSlippageBps,
    demoData.salt
  );
  
  const receipt = await tx.wait();
  console.log('\n✅ RFQ revealed!');
  console.log('Transaction hash:', receipt?.hash);
  console.log('Block number:', receipt?.blockNumber);
  
  const rfq = await intentRegistry.getRFQ(demoData.rfqId);
  console.log('\nRFQ Status:', rfq.status.toString()); // Should be 2 (Revealed)
  
  console.log('\n📈 Next steps:');
  console.log('1. Market makers can now commitQuote()');
  console.log('2. After quotes, call selectBest() with oracle data');
  console.log('3. Finally settle with SettlementVault.fulfill()');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});