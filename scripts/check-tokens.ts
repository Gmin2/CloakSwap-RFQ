import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { TokenA, TokenB } = config.liskSepolia;
  
  const [deployer] = await ethers.getSigners();
  
  const tokenA = await ethers.getContractAt('MockERC20', TokenA);
  const tokenB = await ethers.getContractAt('MockERC20', TokenB);
  
  const decimalsA = await tokenA.decimals();
  const decimalsB = await tokenB.decimals();
  const balanceA = await tokenA.balanceOf(deployer.address);
  const balanceB = await tokenB.balanceOf(deployer.address);
  
  console.log('TokenA decimals:', decimalsA);
  console.log('TokenB decimals:', decimalsB);
  console.log('TokenA balance:', balanceA.toString());
  console.log('TokenB balance:', balanceB.toString());
  
  // Mint more TokenA if needed
  if (balanceA < ethers.parseEther('100')) {
    console.log('\nMinting more TokenA...');
    await tokenA.mint(deployer.address, ethers.parseEther('1000'));
    const newBalance = await tokenA.balanceOf(deployer.address);
    console.log('New TokenA balance:', newBalance.toString());
  }
}

main().catch(console.error);