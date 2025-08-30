import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Wiring Lisk contracts...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('Deploy config not found. Run deploy scripts first.');
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { IntentRegistry, QuoteBook, SettlementVault } = config.liskSepolia;
  
  if (!IntentRegistry || !QuoteBook || !SettlementVault) {
    throw new Error('Missing contract addresses. Run deploy:lisk first.');
  }
  
  console.log('Contract addresses:');
  console.log('IntentRegistry:', IntentRegistry);
  console.log('QuoteBook:', QuoteBook);
  console.log('SettlementVault:', SettlementVault);
  
  const [deployer] = await ethers.getSigners();
  console.log('Wiring with account:', deployer.address);
  
  console.log('\nSetting up contract permissions...');
  
  const intentRegistry = await ethers.getContractAt('IntentRegistry', IntentRegistry);
  const quoteBook = await ethers.getContractAt('QuoteBook', QuoteBook);
  const settlementVault = await ethers.getContractAt('SettlementVault', SettlementVault);
  
  console.log(' All contracts wired successfully!');
  console.log('\nNext steps:');
  console.log('1. Seed demo data: pnpm run seed:lisk');
  console.log('2. Run sanity check: pnpm run sanity:lisk');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});