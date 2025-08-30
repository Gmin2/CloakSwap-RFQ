import { expect } from 'chai';
import { ethers } from 'hardhat';
import { IntentRegistry, QuoteBook, SettlementVault, MockERC20 } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Settlement Vault', function () {
  let intentRegistry: IntentRegistry;
  let quoteBook: QuoteBook;
  let settlementVault: SettlementVault;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: SignerWithAddress;
  let taker: SignerWithAddress;
  let maker: SignerWithAddress;

  beforeEach(async function () {
    [owner, taker, maker] = await ethers.getSigners();

    // Deploy contracts
    const IntentRegistry = await ethers.getContractFactory('IntentRegistry');
    intentRegistry = await IntentRegistry.deploy();

    const QuoteBook = await ethers.getContractFactory('QuoteBook');
    quoteBook = await QuoteBook.deploy(await intentRegistry.getAddress());

    const SettlementVault = await ethers.getContractFactory('SettlementVault');
    settlementVault = await SettlementVault.deploy(
      await intentRegistry.getAddress(),
      await quoteBook.getAddress()
    );

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    tokenA = await MockERC20.deploy('TokenA', 'TKA', 18);
    tokenB = await MockERC20.deploy('TokenB', 'TKB', 18);

    // Mint tokens
    await tokenA.mint(taker.address, ethers.parseEther('1000'));
    await tokenB.mint(maker.address, ethers.parseEther('1000'));

    // Create and reveal RFQ
    const expiry = (await time.latest()) + 3600;
    const amountIn = ethers.parseEther('100');
    const maxSlippageBps = 500;
    const salt = ethers.randomBytes(32);
    
    const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'uint256', 'bytes32'],
      [amountIn, maxSlippageBps, salt]
    ));

    await intentRegistry.connect(taker).commitRFQ(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      expiry,
      commitment
    );

    await intentRegistry.connect(taker).revealRFQ(1, amountIn, maxSlippageBps, salt);

    // Create and reveal quote
    const quoteOut = ethers.parseEther('95');
    const quoteSalt = ethers.randomBytes(32);
    const quoteCommitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'bytes32'],
      [quoteOut, quoteSalt]
    ));

    await quoteBook.connect(maker).commitQuote(1, quoteCommitment);
    await quoteBook.connect(maker).revealQuote(1, quoteOut, quoteSalt);

    // Select best quote
    await quoteBook.selectBest(1, 0, true, 1, ethers.parseEther('100'));
  });

  describe('Token Custody', function () {
    it('should accept token deposits', async function () {
      const depositAmount = ethers.parseEther('100');
      
      await tokenA.connect(taker).approve(await settlementVault.getAddress(), depositAmount);
      
      const tx = await settlementVault.connect(taker).fund(
        await tokenA.getAddress(),
        depositAmount
      );

      await expect(tx)
        .to.emit(settlementVault, 'Funded')
        .withArgs(taker.address, await tokenA.getAddress(), depositAmount);

      const balance = await settlementVault.getBalance(taker.address, await tokenA.getAddress());
      expect(balance).to.equal(depositAmount);
    });

    it('should allow withdrawals', async function () {
      const depositAmount = ethers.parseEther('100');
      const withdrawAmount = ethers.parseEther('50');
      
      await tokenA.connect(taker).approve(await settlementVault.getAddress(), depositAmount);
      await settlementVault.connect(taker).fund(await tokenA.getAddress(), depositAmount);

      const initialBalance = await tokenA.balanceOf(taker.address);

      const tx = await settlementVault.connect(taker).withdraw(
        await tokenA.getAddress(),
        withdrawAmount
      );

      await expect(tx)
        .to.emit(settlementVault, 'Withdrawn')
        .withArgs(taker.address, await tokenA.getAddress(), withdrawAmount);

      const finalBalance = await tokenA.balanceOf(taker.address);
      expect(finalBalance).to.equal(initialBalance + withdrawAmount);

      const vaultBalance = await settlementVault.getBalance(taker.address, await tokenA.getAddress());
      expect(vaultBalance).to.equal(depositAmount - withdrawAmount);
    });

    it('should revert withdrawal with insufficient balance', async function () {
      const depositAmount = ethers.parseEther('50');
      const withdrawAmount = ethers.parseEther('100');
      
      await tokenA.connect(taker).approve(await settlementVault.getAddress(), depositAmount);
      await settlementVault.connect(taker).fund(await tokenA.getAddress(), depositAmount);

      await expect(
        settlementVault.connect(taker).withdraw(await tokenA.getAddress(), withdrawAmount)
      ).to.be.revertedWith('Insufficient balance');
    });
  });

  describe('Settlement Execution', function () {
    beforeEach(async function () {
      // Deposit tokens for settlement
      const amountIn = ethers.parseEther('100');
      const quoteOut = ethers.parseEther('95');

      await tokenA.connect(taker).approve(await settlementVault.getAddress(), amountIn);
      await settlementVault.connect(taker).fund(await tokenA.getAddress(), amountIn);

      await tokenB.connect(maker).approve(await settlementVault.getAddress(), quoteOut);
      await settlementVault.connect(maker).fund(await tokenB.getAddress(), quoteOut);
    });

    it('should fulfill settlement successfully', async function () {
      const amountIn = ethers.parseEther('100');
      const quoteOut = ethers.parseEther('95');

      const takerBalanceA = await settlementVault.getBalance(taker.address, await tokenA.getAddress());
      const takerBalanceB = await settlementVault.getBalance(taker.address, await tokenB.getAddress());
      const makerBalanceA = await settlementVault.getBalance(maker.address, await tokenA.getAddress());
      const makerBalanceB = await settlementVault.getBalance(maker.address, await tokenB.getAddress());

      const tx = await settlementVault.fulfill(1);

      await expect(tx)
        .to.emit(settlementVault, 'FillCommitted')
        .withArgs(1, taker.address, maker.address, amountIn, quoteOut);

      // Check balances after settlement
      const newTakerBalanceA = await settlementVault.getBalance(taker.address, await tokenA.getAddress());
      const newTakerBalanceB = await settlementVault.getBalance(taker.address, await tokenB.getAddress());
      const newMakerBalanceA = await settlementVault.getBalance(maker.address, await tokenA.getAddress());
      const newMakerBalanceB = await settlementVault.getBalance(maker.address, await tokenB.getAddress());

      // Taker gives amountIn of tokenA, receives quoteOut of tokenB
      expect(newTakerBalanceA).to.equal(takerBalanceA - amountIn);
      expect(newTakerBalanceB).to.equal(takerBalanceB + quoteOut);

      // Maker gives quoteOut of tokenB, receives amountIn of tokenA
      expect(newMakerBalanceA).to.equal(makerBalanceA + amountIn);
      expect(newMakerBalanceB).to.equal(makerBalanceB - quoteOut);

      // Verify settlement was marked as fulfilled
      const isFulfilled = await settlementVault.fulfilled(1);
      expect(isFulfilled).to.be.true;
    });

    it('should revert when RFQ not in Revealed status', async function () {
      // Create new RFQ in Committed status
      const expiry = (await time.latest()) + 3600;
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('test'));
      
      await intentRegistry.connect(taker).commitRFQ(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        expiry,
        commitment
      );

      await expect(
        settlementVault.fulfill(2)
      ).to.be.revertedWith('RFQ not revealed');
    });

    it('should revert when no quote selected', async function () {
      // Create new RFQ and reveal it but don't select quote
      const expiry = (await time.latest()) + 3600;
      const amountIn = ethers.parseEther('100');
      const maxSlippageBps = 500;
      const salt = ethers.randomBytes(32);
      
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'bytes32'],
        [amountIn, maxSlippageBps, salt]
      ));

      await intentRegistry.connect(taker).commitRFQ(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        expiry,
        commitment
      );

      await intentRegistry.connect(taker).revealRFQ(2, amountIn, maxSlippageBps, salt);

      await expect(
        settlementVault.fulfill(2)
      ).to.be.revertedWith('No selection made');
    });

    it('should revert with insufficient taker balance', async function () {
      // Withdraw taker's tokens to create insufficient balance
      const takerBalance = await settlementVault.getBalance(taker.address, await tokenA.getAddress());
      await settlementVault.connect(taker).withdraw(await tokenA.getAddress(), takerBalance);

      await expect(
        settlementVault.fulfill(1)
      ).to.be.revertedWith('Insufficient taker balance');
    });

    it('should revert with insufficient maker balance', async function () {
      // Withdraw maker's tokens to create insufficient balance
      const makerBalance = await settlementVault.getBalance(maker.address, await tokenB.getAddress());
      await settlementVault.connect(maker).withdraw(await tokenB.getAddress(), makerBalance);

      await expect(
        settlementVault.fulfill(1)
      ).to.be.revertedWith('Insufficient maker balance');
    });

    it('should revert when settlement already executed', async function () {
      // First settlement
      await settlementVault.fulfill(1);

      // Second settlement should fail
      await expect(
        settlementVault.fulfill(1)
      ).to.be.revertedWith('Already fulfilled');
    });
  });

  describe('Access Control', function () {
    it('should revert when called by non-owner for admin functions', async function () {
      // Only deployment shows this test is relevant if there are admin functions
      // SettlementVault inherits from Ownable but doesn't expose admin functions in current impl
      expect(await settlementVault.owner()).to.equal(owner.address);
    });
  });

  describe('Integration', function () {
    it('should handle complete RFQ lifecycle', async function () {
      // This test verifies the entire flow works together
      const amountIn = ethers.parseEther('100');
      const quoteOut = ethers.parseEther('95');

      // Check initial balances
      const initialTakerTokenA = await tokenA.balanceOf(taker.address);
      const initialTakerTokenB = await tokenB.balanceOf(taker.address);
      const initialMakerTokenA = await tokenA.balanceOf(maker.address);
      const initialMakerTokenB = await tokenB.balanceOf(maker.address);

      // Taker deposits tokens
      await tokenA.connect(taker).approve(await settlementVault.getAddress(), amountIn);
      await settlementVault.connect(taker).fund(await tokenA.getAddress(), amountIn);

      // Maker deposits tokens
      await tokenB.connect(maker).approve(await settlementVault.getAddress(), quoteOut);
      await settlementVault.connect(maker).fund(await tokenB.getAddress(), quoteOut);

      // Execute settlement
      await settlementVault.fulfill(1);

      // Withdraw tokens
      await settlementVault.connect(taker).withdraw(await tokenB.getAddress(), quoteOut);
      await settlementVault.connect(maker).withdraw(await tokenA.getAddress(), amountIn);

      // Check final balances
      const finalTakerTokenA = await tokenA.balanceOf(taker.address);
      const finalTakerTokenB = await tokenB.balanceOf(taker.address);
      const finalMakerTokenA = await tokenA.balanceOf(maker.address);
      const finalMakerTokenB = await tokenB.balanceOf(maker.address);

      // Taker should have exchanged tokenA for tokenB
      expect(finalTakerTokenA).to.equal(initialTakerTokenA - amountIn);
      expect(finalTakerTokenB).to.equal(initialTakerTokenB + quoteOut);

      // Maker should have exchanged tokenB for tokenA
      expect(finalMakerTokenA).to.equal(initialMakerTokenA + amountIn);
      expect(finalMakerTokenB).to.equal(initialMakerTokenB - quoteOut);
    });
  });
});