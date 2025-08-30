import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Deploying Flare contracts to Coston2...');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  console.log('\n1. Deploying FTSOReader...');
  const FTSOReader = await ethers.getContractFactory('FTSOReader');
  const ftsoReader = await FTSOReader.deploy();
  await ftsoReader.waitForDeployment();
  const ftsoReaderAddress = await ftsoReader.getAddress();
  console.log('FTSOReader deployed to:', ftsoReaderAddress);

  console.log('\n2. Deploying RNGReader...');
  const RNGReader = await ethers.getContractFactory('RNGReader');
  const rngReader = await RNGReader.deploy();
  await rngReader.waitForDeployment();
  const rngReaderAddress = await rngReader.getAddress();
  console.log('RNGReader deployed to:', rngReaderAddress);

  console.log('\n3. Deploying FDCClient...');
  const FDCClient = await ethers.getContractFactory('FDCClient');
  const fdcClient = await FDCClient.deploy();
  await fdcClient.waitForDeployment();
  const fdcClientAddress = await fdcClient.getAddress();
  console.log('FDCClient deployed to:', fdcClientAddress);

  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  let existingConfig = {};
  
  if (fs.existsSync(configPath)) {
    existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const updatedConfig = {
    ...existingConfig,
    coston2: {
      FTSOReader: ftsoReaderAddress,
      RNGReader: rngReaderAddress,
      FDCClient: fdcClientAddress
    }
  };
  
  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2));
  
  console.log('\n Flare contracts deployed successfully!');
  console.log('=� Addresses saved to deploy-config/addresses.json');
  console.log('\nNext steps:');
  console.log('1. Wire Lisk contracts: pnpm run wire:lisk');
  console.log('2. Seed demo data: pnpm run seed:lisk');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});