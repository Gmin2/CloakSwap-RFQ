import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Setting up RFQ for relayer testing...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  const [deployer] = await ethers.getSigners();
  const intentRegistry = await ethers.getContractAt('IntentRegistry', config.liskSepolia.IntentRegistry);
  const quoteBook = await ethers.getContractAt('QuoteBook', config.liskSepolia.QuoteBook);
  
  // Create new RFQ
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const amountIn = ethers.parseEther('50');
  const maxSlippageBps = 400;
  const salt = ethers.randomBytes(32);
  
  const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'uint256', 'bytes32'],
    [amountIn, maxSlippageBps, salt]
  ));
  
  console.log('\n1. Creating RFQ...');
  const commitTx = await intentRegistry.commitRFQ(
    config.liskSepolia.TokenA,
    config.liskSepolia.TokenB,
    expiry,
    commitment
  );
  await commitTx.wait();
  
  // Get the new RFQ ID
  const nextId = await intentRegistry.nextRFQId();
  const rfqId = Number(nextId) - 1; // Just created RFQ
  
  console.log(`2. Revealing RFQ ${rfqId}...`);
  const revealTx = await intentRegistry.revealRFQ(rfqId, amountIn, maxSlippageBps, salt);
  await revealTx.wait();
  
  console.log('3. Adding quote...');
  const quoteOut = ethers.parseEther('47.5'); // 5% slippage
  const quoteSalt = ethers.randomBytes(32);
  const quoteCommitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'bytes32'],
    [quoteOut, quoteSalt]
  ));
  
  const commitQuoteTx = await quoteBook.commitQuote(rfqId, quoteCommitment);
  await commitQuoteTx.wait();
  
  const revealQuoteTx = await quoteBook.revealQuote(rfqId, quoteOut, quoteSalt);
  await revealQuoteTx.wait();
  
  console.log(`\n✅ RFQ ${rfqId} ready for relayer selection!`);
  console.log(`Run: cd relayer-bot && pnpm relayer:select --rfq ${rfqId}`);
}

main().catch(console.error);