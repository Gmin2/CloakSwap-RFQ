import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Running sanity check on deployed contracts...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const lisk = config.liskSepolia;
  const flare = config.coston2;
  
  const [deployer] = await ethers.getSigners();
  console.log('Checking with account:', deployer.address);
  
  console.log('\nVerifying Lisk contracts...');
  
  // Check IntentRegistry
  const intentRegistry = await ethers.getContractAt('IntentRegistry', lisk.IntentRegistry);
  const nextRFQId = await intentRegistry.nextRFQId();
  console.log('✅ IntentRegistry - Next RFQ ID:', nextRFQId.toString());
  
  // Check QuoteBook
  const quoteBook = await ethers.getContractAt('QuoteBook', lisk.QuoteBook);
  const intentRegistryAddr = await quoteBook.intentRegistry();
  console.log('✅ QuoteBook - Intent Registry:', intentRegistryAddr);
  
  // Check SettlementVault
  const settlementVault = await ethers.getContractAt('SettlementVault', lisk.SettlementVault);
  const vaultIntentRegistry = await settlementVault.intentRegistry();
  const vaultQuoteBook = await settlementVault.quoteBook();
  console.log('✅ SettlementVault - Intent Registry:', vaultIntentRegistry);
  console.log('✅ SettlementVault - Quote Book:', vaultQuoteBook);
  
  console.log('\nChecking demo data...');
  const demoDataPath = path.join(__dirname, '../deploy-config/demo-data.json');
  
  if (fs.existsSync(demoDataPath)) {
    const demoData = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
    console.log('✅ Demo data exists');
    
    try {
      const rfq = await intentRegistry.getRFQ(demoData.rfqId);
      console.log('✅ Demo RFQ found:');
      console.log('  - Owner:', rfq.owner);
      console.log('  - Status:', rfq.status);
      console.log('  - Token In:', rfq.tokenIn);
      console.log('  - Token Out:', rfq.tokenOut);
      
      if (rfq.status === 1n) {
        console.log('💡 RFQ is committed. You can now call revealRFQ()');
      } else if (rfq.status === 2n) {
        console.log('💡 RFQ is revealed. Market makers can commitQuote()');
      }
    } catch (error) {
      console.log('❌ Demo RFQ not found. Run seed:lisk first.');
    }
  } else {
    console.log('❌ No demo data. Run seed:lisk first.');
  }
  
  console.log('\nContract URLs:');
  console.log('Lisk Sepolia Explorer:');
  console.log('- IntentRegistry:', `https://sepolia-blockscout.lisk.com/address/${lisk.IntentRegistry}`);
  console.log('- QuoteBook:', `https://sepolia-blockscout.lisk.com/address/${lisk.QuoteBook}`);
  console.log('- SettlementVault:', `https://sepolia-blockscout.lisk.com/address/${lisk.SettlementVault}`);
  
  if (lisk.TokenA && lisk.TokenB) {
    console.log('- TokenA (USDC):', `https://sepolia-blockscout.lisk.com/address/${lisk.TokenA}`);
    console.log('- TokenB (WETH):', `https://sepolia-blockscout.lisk.com/address/${lisk.TokenB}`);
  }
  
  console.log('\nCoston2 Explorer:');
  console.log('- FTSOReader:', `https://coston2.testnet.flarescan.com/address/${flare.FTSOReader}`);
  console.log('- RNGReader:', `https://coston2.testnet.flarescan.com/address/${flare.RNGReader}`);
  console.log('- FDCClient:', `https://coston2.testnet.flarescan.com/address/${flare.FDCClient}`);
  
  console.log('\n✅ Sanity check completed!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});