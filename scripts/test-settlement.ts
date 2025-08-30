import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Testing settlement execution...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { SettlementVault, TokenA, TokenB } = config.liskSepolia;
  
  const [deployer] = await ethers.getSigners();
  console.log('Settlement account:', deployer.address);
  
  const settlementVault = await ethers.getContractAt('SettlementVault', SettlementVault);
  const tokenA = await ethers.getContractAt('MockERC20', TokenA);
  const tokenB = await ethers.getContractAt('MockERC20', TokenB);
  
  // Check token balances
  const userBalanceA = await tokenA.balanceOf(deployer.address);
  const userBalanceB = await tokenB.balanceOf(deployer.address);
  
  console.log('\nCurrent token balances:');
  console.log('TokenA:', ethers.formatEther(userBalanceA));
  console.log('TokenB:', ethers.formatEther(userBalanceB));
  
  // Mint tokens if needed
  if (userBalanceA === 0n) {
    console.log('\nMinting TokenA (USDC)...');
    await tokenA.mint(deployer.address, ethers.parseEther('1000'));
  }
  
  if (userBalanceB === 0n) {
    console.log('Minting TokenB (WETH)...');
    await tokenB.mint(deployer.address, ethers.parseEther('100'));
  }
  
  // Fund vault with required amounts (match demo RFQ which uses 18 decimals)
  const amountIn = ethers.parseEther('100'); // 100 TokenA but RFQ expects 18 decimals
  const quoteOut = ethers.parseEther('95'); // 95 TokenB
  
  console.log('\nFunding vault...');
  console.log('Depositing', ethers.formatEther(amountIn), 'TokenA (taker)');
  console.log('Depositing', ethers.formatEther(quoteOut), 'TokenB (maker)');
  
  // Approve and fund
  await tokenA.approve(SettlementVault, amountIn);
  await settlementVault.fund(TokenA, amountIn);
  
  await tokenB.approve(SettlementVault, quoteOut);
  await settlementVault.fund(TokenB, quoteOut);
  
  // Check vault balances
  const vaultBalanceA = await settlementVault.getBalance(deployer.address, TokenA);
  const vaultBalanceB = await settlementVault.getBalance(deployer.address, TokenB);
  
  console.log('\nVault balances:');
  console.log('TokenA:', ethers.formatEther(vaultBalanceA));
  console.log('TokenB:', ethers.formatEther(vaultBalanceB));
  
  // Execute settlement
  console.log('\nExecuting settlement...');
  const settleTx = await settlementVault.fulfill(1);
  const settleReceipt = await settleTx.wait();
  
  console.log('✅ Settlement executed!');
  console.log('Transaction hash:', settleReceipt?.hash);
  
  // Check final vault balances
  const finalBalanceA = await settlementVault.getBalance(deployer.address, TokenA);
  const finalBalanceB = await settlementVault.getBalance(deployer.address, TokenB);
  
  console.log('\nFinal vault balances:');
  console.log('TokenA:', ethers.formatEther(finalBalanceA));
  console.log('TokenB:', ethers.formatEther(finalBalanceB));
  
  console.log('\n🎉 Manual settlement test complete!');
  console.log('Taker traded 100 TokenA for 95 TokenB (5% slippage)');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});