import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Submitting market maker quotes...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { QuoteBook } = config.liskSepolia;
  
  const [deployer] = await ethers.getSigners();
  console.log('Submitting quotes as:', deployer.address);
  
  const quoteBook = await ethers.getContractAt('QuoteBook', QuoteBook);
  
  // Market maker quote: offering 95 WETH for 100 USDC (5% slippage)
  const quoteOut = ethers.parseEther('95');
  const salt = ethers.randomBytes(32);
  
  const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'bytes32'],
    [quoteOut, salt]
  ));
  
  console.log('\nCommitting quote...');
  console.log('Quote Out:', ethers.formatEther(quoteOut), 'tokens (5% slippage)');
  console.log('Salt:', ethers.hexlify(salt));
  
  // Commit quote
  const commitTx = await quoteBook.commitQuote(1, commitment);
  await commitTx.wait();
  console.log('✅ Quote committed');
  
  // Reveal quote
  console.log('\nRevealing quote...');
  const revealTx = await quoteBook.revealQuote(1, quoteOut, salt);
  await revealTx.wait();
  console.log('✅ Quote revealed');
  
  // Check quotes
  const quotes = await quoteBook.getQuotes(1);
  console.log('\nQuotes for RFQ #1:', quotes.length);
  for (let i = 0; i < quotes.length; i++) {
    console.log(`Quote ${i}:`, {
      maker: quotes[i].maker,
      quoteOut: ethers.formatEther(quotes[i].quoteOut),
      revealed: quotes[i].revealed
    });
  }
  
  console.log('\n📊 Next step: Select best quote with oracle data');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});