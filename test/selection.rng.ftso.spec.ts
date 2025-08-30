import { expect } from 'chai';
import { ethers } from 'hardhat';
import { IntentRegistry, QuoteBook, MockERC20 } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Selection RNG/FTSO', function () {
  let intentRegistry: IntentRegistry;
  let quoteBook: QuoteBook;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: SignerWithAddress;
  let taker: SignerWithAddress;
  let maker1: SignerWithAddress;
  let maker2: SignerWithAddress;
  let maker3: SignerWithAddress;

  beforeEach(async function () {
    [owner, taker, maker1, maker2, maker3] = await ethers.getSigners();

    // Deploy contracts
    const IntentRegistry = await ethers.getContractFactory('IntentRegistry');
    intentRegistry = await IntentRegistry.deploy();

    const QuoteBook = await ethers.getContractFactory('QuoteBook');
    quoteBook = await QuoteBook.deploy(await intentRegistry.getAddress());

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    tokenA = await MockERC20.deploy('TokenA', 'TKA', 18);
    tokenB = await MockERC20.deploy('TokenB', 'TKB', 18);

    // Create and reveal an RFQ
    const expiry = (await time.latest()) + 3600;
    const amountIn = ethers.parseEther('100');
    const maxSlippageBps = 500; // 5%
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
  });

  describe('Quote Selection with RNG', function () {
    it('should select best quote when RNG is secure', async function () {
      // Two makers commit identical quotes (tie scenario)
      const quoteOut = ethers.parseEther('95');
      const salt1 = ethers.randomBytes(32);
      const salt2 = ethers.randomBytes(32);
      
      const commitment1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'bytes32'],
        [quoteOut, salt1]
      ));
      const commitment2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'bytes32'],
        [quoteOut, salt2]
      ));

      await quoteBook.connect(maker1).commitQuote(1, commitment1);
      await quoteBook.connect(maker2).commitQuote(1, commitment2);
      
      await quoteBook.connect(maker1).revealQuote(1, quoteOut, salt1);
      await quoteBook.connect(maker2).revealQuote(1, quoteOut, salt2);

      // Select with secure RNG (rngValue=0 should pick first valid quote)
      const rngValue = 0;
      const isSecure = true;
      const snapshotId = 1;
      const refPrice = ethers.parseEther('100'); // 1:1 reference price

      const tx = await quoteBook.selectBest(1, rngValue, isSecure, snapshotId, refPrice);

      await expect(tx)
        .to.emit(quoteBook, 'BestQuoteSelected')
        .withArgs(1, maker1.address, quoteOut, 0); // Index 0 selected

      const selectedQuote = await quoteBook.getSelectedQuote(1);
      expect(selectedQuote.maker).to.equal(maker1.address);
      expect(selectedQuote.quoteOut).to.equal(quoteOut);
    });

    it('should break tie using RNG deterministically', async function () {
      // Two identical quotes
      const quoteOut = ethers.parseEther('95');
      const salt1 = ethers.randomBytes(32);
      const salt2 = ethers.randomBytes(32);
      
      const commitment1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [quoteOut, salt1]));
      const commitment2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [quoteOut, salt2]));

      await quoteBook.connect(maker1).commitQuote(1, commitment1);
      await quoteBook.connect(maker2).commitQuote(1, commitment2);
      
      await quoteBook.connect(maker1).revealQuote(1, quoteOut, salt1);
      await quoteBook.connect(maker2).revealQuote(1, quoteOut, salt2);

      // RNG value 1 % 2 valid quotes = index 1 (second maker)
      const rngValue = 1;
      const isSecure = true;
      const snapshotId = 1;
      const refPrice = ethers.parseEther('100');

      await quoteBook.selectBest(1, rngValue, isSecure, snapshotId, refPrice);

      const selectedQuote = await quoteBook.getSelectedQuote(1);
      expect(selectedQuote.maker).to.equal(maker2.address); // Index 1 selected
    });

    it('should revert when RNG is not secure', async function () {
      const quoteOut = ethers.parseEther('95');
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [quoteOut, salt]));

      await quoteBook.connect(maker1).commitQuote(1, commitment);
      await quoteBook.connect(maker1).revealQuote(1, quoteOut, salt);

      await expect(
        quoteBook.selectBest(1, 123, false, 1, ethers.parseEther('100'))
      ).to.be.revertedWith('RNG not secure');
    });

    it('should ignore quotes outside maxDeviationBps', async function () {
      // Create quotes: one good, one too far from reference price
      const goodQuote = ethers.parseEther('95'); // 5% slippage - within 5% limit
      const badQuote = ethers.parseEther('85');  // 15% slippage - exceeds 5% limit
      
      const salt1 = ethers.randomBytes(32);
      const salt2 = ethers.randomBytes(32);
      
      const commitment1 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [goodQuote, salt1]));
      const commitment2 = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [badQuote, salt2]));

      await quoteBook.connect(maker1).commitQuote(1, commitment1);
      await quoteBook.connect(maker2).commitQuote(1, commitment2);
      
      await quoteBook.connect(maker1).revealQuote(1, goodQuote, salt1);
      await quoteBook.connect(maker2).revealQuote(1, badQuote, salt2);

      const rngValue = 0;
      const isSecure = true;
      const snapshotId = 1;
      const refPrice = ethers.parseEther('100'); // Reference price

      const tx = await quoteBook.selectBest(1, rngValue, isSecure, snapshotId, refPrice);

      // Only the good quote should be selected
      await expect(tx)
        .to.emit(quoteBook, 'BestQuoteSelected')
        .withArgs(1, maker1.address, goodQuote, 0);

      const selectedQuote = await quoteBook.getSelectedQuote(1);
      expect(selectedQuote.maker).to.equal(maker1.address);
      expect(selectedQuote.quoteOut).to.equal(goodQuote);
    });

    it('should revert when no valid quotes', async function () {
      // Quote with excessive slippage
      const badQuote = ethers.parseEther('80'); // 20% slippage
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [badQuote, salt]));

      await quoteBook.connect(maker1).commitQuote(1, commitment);
      await quoteBook.connect(maker1).revealQuote(1, badQuote, salt);

      await expect(
        quoteBook.selectBest(1, 0, true, 1, ethers.parseEther('100'))
      ).to.be.revertedWith('No valid quotes');
    });

    it('should revert when selection already made', async function () {
      const quoteOut = ethers.parseEther('95');
      const salt = ethers.randomBytes(32);
      const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'bytes32'], [quoteOut, salt]));

      await quoteBook.connect(maker1).commitQuote(1, commitment);
      await quoteBook.connect(maker1).revealQuote(1, quoteOut, salt);

      // First selection
      await quoteBook.selectBest(1, 0, true, 1, ethers.parseEther('100'));

      // Second selection should fail
      await expect(
        quoteBook.selectBest(1, 0, true, 1, ethers.parseEther('100'))
      ).to.be.revertedWith('Selection already made');
    });
  });
});