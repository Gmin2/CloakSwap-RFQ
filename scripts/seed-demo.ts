import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Seeding demo data on Lisk Sepolia...');
  
  const configPath = path.join(__dirname, '../deploy-config/addresses.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const { IntentRegistry } = config.liskSepolia;
  
  const [deployer] = await ethers.getSigners();
  console.log('Seeding with account:', deployer.address);
  
  const intentRegistry = await ethers.getContractAt('IntentRegistry', IntentRegistry);
  
  console.log('\n1. Deploying mock tokens...');
  
  // Deploy TokenA (e.g., USDC)
  const TokenA = await ethers.getContractFactory('MockERC20');
  const tokenA = await TokenA.deploy('Mock USDC', 'USDC', 6);
  await tokenA.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  console.log('TokenA (USDC) deployed to:', tokenAAddress);
  
  // Deploy TokenB (e.g., WETH)
  const TokenB = await ethers.getContractFactory('MockERC20');
  const tokenB = await TokenB.deploy('Mock WETH', 'WETH', 18);
  await tokenB.waitForDeployment();
  const tokenBAddress = await tokenB.getAddress();
  console.log('TokenB (WETH) deployed to:', tokenBAddress);
  
  // Update addresses.json with token addresses
  config.liskSepolia.TokenA = tokenAAddress;
  config.liskSepolia.TokenB = tokenBAddress;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log('\n2. Creating demo RFQ commitment...');
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  
  // Create commitment hash
  const amountIn = ethers.parseEther('100');
  const maxSlippageBps = 500; // 5%
  const salt = ethers.randomBytes(32);
  const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'uint256', 'bytes32'],
    [amountIn, maxSlippageBps, salt]
  ));
  
  console.log('Commitment details:');
  console.log('- Token In:', tokenAAddress);
  console.log('- Token Out:', tokenBAddress);
  console.log('- Amount In:', ethers.formatEther(amountIn), 'tokens');
  console.log('- Max Slippage:', maxSlippageBps / 100, '%');
  console.log('- Expiry:', new Date(expiry * 1000).toISOString());
  console.log('- Salt:', ethers.hexlify(salt));
  
  const tx = await intentRegistry.commitRFQ(tokenAAddress, tokenBAddress, expiry, commitment);
  const receipt = await tx.wait();
  
  console.log('\n Demo RFQ committed!');
  console.log('Transaction hash:', receipt.hash);
  console.log('Block number:', receipt.blockNumber);
  
  // Extract RFQ ID from event
  const events = receipt.logs;
  console.log('Events emitted:', events.length);
  
  console.log('\n=� Next steps:');
  console.log('1. Wait for commit window to pass');
  console.log('2. Call revealRFQ() with the commitment details');
  console.log('3. Market makers can then commitQuote()');
  console.log('4. Run sanity check: pnpm run sanity:lisk');
  
  // Save demo data for later use
  const demoData = {
    rfqId: 1, // First RFQ
    amountIn: amountIn.toString(),
    maxSlippageBps,
    salt: ethers.hexlify(salt),
    tokenA: tokenAAddress,
    tokenB: tokenBAddress,
    expiry,
    commitment
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../deploy-config/demo-data.json'),
    JSON.stringify(demoData, null, 2)
  );
  
  console.log('=� Demo data saved to deploy-config/demo-data.json');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});