import { expect } from 'chai';
import { ethers } from 'hardhat';
import { IntentRegistry, MockERC20 } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('RFQ Commit/Reveal', function () {
  let intentRegistry: IntentRegistry;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const IntentRegistry = await ethers.getContractFactory('IntentRegistry');
    intentRegistry = await IntentRegistry.deploy();

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    tokenA = await MockERC20.deploy('TokenA', 'TKA', 18);
    tokenB = await MockERC20.deploy('TokenB', 'TKB', 18);
  });

  describe('Commit Phase', function () {
    it('should commit RFQ successfully', async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('test-commitment'));

      const tx = await intentRegistry.connect(user).commitRFQ(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        expiry,
        commitment
      );

      await expect(tx)
        .to.emit(intentRegistry, 'RFQCommitted')
        .withArgs(1, user.address, await tokenA.getAddress(), await tokenB.getAddress(), 0, expiry);

      const rfq = await intentRegistry.getRFQ(1);
      expect(rfq.owner).to.equal(user.address);
      expect(rfq.status).to.equal(1); // Committed
    });

    it('should revert with expired intent', async function () {
      const expiry = Math.floor(Date.now() / 1000) - 1; // Past expiry
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('test-commitment'));

      await expect(
        intentRegistry.commitRFQ(await tokenA.getAddress(), await tokenB.getAddress(), expiry, commitment)
      ).to.be.revertedWith('Intent expired');
    });

    it('should revert with same token addresses', async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('test-commitment'));

      await expect(
        intentRegistry.commitRFQ(await tokenA.getAddress(), await tokenA.getAddress(), expiry, commitment)
      ).to.be.revertedWith('Same token');
    });
  });

  describe('Reveal Phase', function () {
    let rfqId: number;
    let amountIn: bigint;
    let maxSlippageBps: number;
    let salt: string;
    let commitment: string;

    beforeEach(async function () {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      amountIn = ethers.parseEther('100');
      maxSlippageBps = 500;
      salt = ethers.hexlify(ethers.randomBytes(32));
      
      commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'bytes32'],
        [amountIn, maxSlippageBps, salt]
      ));

      const tx = await intentRegistry.connect(user).commitRFQ(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        expiry,
        commitment
      );
      
      const receipt = await tx.wait();
      rfqId = 1;
    });

    it('should reveal RFQ successfully', async function () {
      const tx = await intentRegistry.connect(user).revealRFQ(rfqId, amountIn, maxSlippageBps, salt);

      await expect(tx)
        .to.emit(intentRegistry, 'RFQRevealed')
        .withArgs(rfqId, amountIn, maxSlippageBps);

      const rfq = await intentRegistry.getRFQ(rfqId);
      expect(rfq.amountIn).to.equal(amountIn);
      expect(rfq.maxSlippageBps).to.equal(maxSlippageBps);
      expect(rfq.status).to.equal(2); // Revealed
    });

    it('should revert with invalid salt', async function () {
      const wrongSalt = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        intentRegistry.connect(user).revealRFQ(rfqId, amountIn, maxSlippageBps, wrongSalt)
      ).to.be.revertedWith('Invalid reveal');
    });

    it('should revert when not owner', async function () {
      await expect(
        intentRegistry.connect(owner).revealRFQ(rfqId, amountIn, maxSlippageBps, salt)
      ).to.be.revertedWith('Not owner');
    });

    it('should revert with invalid slippage', async function () {
      await expect(
        intentRegistry.connect(user).revealRFQ(rfqId, amountIn, 10001, salt)
      ).to.be.revertedWith('Invalid slippage');
    });
  });
});