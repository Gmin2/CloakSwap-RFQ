import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Deploying Lisk contracts to Lisk Sepolia...');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  console.log('\n1. Deploying IntentRegistry...');
  const IntentRegistry = await ethers.getContractFactory('IntentRegistry');
  const intentRegistry = await IntentRegistry.deploy();
  console.log('IntentRegistry deployed to: 1');
  await intentRegistry.waitForDeployment();
  console.log('IntentRegistry deployed to: 2');
  const intentRegistryAddress = await intentRegistry.getAddress();
  console.log('IntentRegistry deployed to:', intentRegistryAddress);

  console.log('\n2. Deploying QuoteBook...');
  const QuoteBook = await ethers.getContractFactory('QuoteBook');
  const quoteBook = await QuoteBook.deploy(intentRegistryAddress);
  await quoteBook.waitForDeployment();
  const quoteBookAddress = await quoteBook.getAddress();
  console.log('QuoteBook deployed to:', quoteBookAddress);

  console.log('\n3. Deploying SettlementVault...');
  const SettlementVault = await ethers.getContractFactory('SettlementVault');
  const settlementVault = await SettlementVault.deploy(intentRegistryAddress, quoteBookAddress);
  await settlementVault.waitForDeployment();
  const settlementVaultAddress = await settlementVault.getAddress();
  console.log('SettlementVault deployed to:', settlementVaultAddress);

  const deployedAddresses = {
    liskSepolia: {
      IntentRegistry: intentRegistryAddress,
      QuoteBook: quoteBookAddress,
      SettlementVault: settlementVaultAddress,
      TokenA: "",
      TokenB: ""
    }
  };

  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  let existingConfig = {};
  
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  
  const updatedConfig = { ...existingConfig, ...deployedAddresses };
  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
  
  console.log('\n Lisk contracts deployed successfully!');
  console.log('=� Addresses saved to deploy-config/addresses.json');
  console.log('\nNext steps:');
  console.log('1. Deploy Flare contracts: pnpm run deploy:flare');
  console.log('2. Wire Lisk contracts: pnpm run wire:lisk');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});