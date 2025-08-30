import { expect } from 'chai';
import { ethers } from 'hardhat';
import { IntentRegistry, QuoteBook, MockERC20 } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';

describe('Quotes Commit/Reveal', function () {
  let intentRegistry: IntentRegistry;
  let quoteBook: QuoteBook;
  let tokenA: MockERC20;
  let tokenB: MockERC20;
  let owner: SignerWithAddress;
  let taker: SignerWithAddress;
  let maker1: SignerWithAddress;
  let maker2: SignerWithAddress;

  beforeEach(async function () {
    [owner, taker, maker1, maker2] = await ethers.getSigners();

    // Deploy contracts
    const IntentRegistry = await ethers.getContractFactory('IntentRegistry');
    intentRegistry = await IntentRegistry.deploy();

    const QuoteBook = await ethers.getContractFactory('QuoteBook');
    quoteBook = await QuoteBook.deploy(await intentRegistry.getAddress());

    const MockERC20 = await ethers.getContractFactory('MockERC20');
    tokenA = await MockERC20.deploy('TokenA', 'TKA', 18);
    tokenB = await MockERC20.deploy('TokenB', 'TKB', 18);

    // Create and reveal an RFQ for testing
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
  });

  describe('Quote Commit Phase', function () {
    it('should allow maker to commit quote', async function () {
      const quoteCommitment = ethers.keccak256(ethers.toUtf8Bytes('quote-commitment'));

      const tx = await quoteBook.connect(maker1).commitQuote(1, quoteCommitment);

      await expect(tx)
        .to.emit(quoteBook, 'QuoteCommitted')
        .withArgs(1, maker1.address, quoteCommitment);

      const quotes = await quoteBook.getQuotes(1);
      expect(quotes.length).to.equal(1);
      expect(quotes[0].maker).to.equal(maker1.address);
      expect(quotes[0].commitment).to.equal(quoteCommitment);
      expect(quotes[0].revealed).to.be.false;
    });

    it('should allow multiple makers to commit quotes', async function () {
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes('quote1'));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes('quote2'));

      await quoteBook.connect(maker1).commitQuote(1, commitment1);
      await quoteBook.connect(maker2).commitQuote(1, commitment2);

      const quotes = await quoteBook.getQuotes(1);
      expect(quotes.length).to.equal(2);
      expect(quotes[0].maker).to.equal(maker1.address);
      expect(quotes[1].maker).to.equal(maker2.address);
    });

    it('should revert for non-existent RFQ', async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes('quote'));

      await expect(
        quoteBook.connect(maker1).commitQuote(999, commitment)
      ).to.be.revertedWith('RFQ not found');
    });

    it('should revert with empty commitment', async function () {
      await expect(
        quoteBook.connect(maker1).commitQuote(1, ethers.ZeroHash)
      ).to.be.revertedWith('Empty commitment');
    });
  });

  describe('Quote Reveal Phase', function () {
    let quoteOut: bigint;
    let salt: string;
    let commitment: string;

    beforeEach(async function () {
      quoteOut = ethers.parseEther('95'); // Offering 95 tokenOut for 100 tokenIn
      salt = ethers.hexlify(ethers.randomBytes(32));
      
      commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'bytes32'],
        [quoteOut, salt]
      ));

      await quoteBook.connect(maker1).commitQuote(1, commitment);
    });

    it('should reveal quote successfully', async function () {
      const tx = await quoteBook.connect(maker1).revealQuote(1, quoteOut, salt);

      await expect(tx)
        .to.emit(quoteBook, 'QuoteRevealed')
        .withArgs(1, maker1.address, quoteOut);

      const quotes = await quoteBook.getQuotes(1);
      expect(quotes[0].revealed).to.be.true;
      expect(quotes[0].quoteOut).to.equal(quoteOut);
    });

    it('should revert with invalid salt', async function () {
      const wrongSalt = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        quoteBook.connect(maker1).revealQuote(1, quoteOut, wrongSalt)
      ).to.be.revertedWith('Invalid reveal');
    });

    it('should revert with zero quote', async function () {
      await expect(
        quoteBook.connect(maker1).revealQuote(1, 0, salt)
      ).to.be.revertedWith('Invalid quote');
    });

    it('should revert when no matching commitment found', async function () {
      await expect(
        quoteBook.connect(maker2).revealQuote(1, quoteOut, salt)
      ).to.be.revertedWith('No matching commitment');
    });
  });

  describe('Time Windows', function () {
    it('should handle expired RFQ', async function () {
      // Create RFQ with short expiry
      const shortExpiry = (await time.latest()) + 60;
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
        shortExpiry,
        commitment
      );

      // Reveal the RFQ first
      await intentRegistry.connect(taker).revealRFQ(2, amountIn, maxSlippageBps, salt);

      // Fast forward past expiry
      await time.increase(120);

      const quoteCommitment = ethers.keccak256(ethers.toUtf8Bytes('quote'));
      
      await expect(
        quoteBook.connect(maker1).commitQuote(2, quoteCommitment)
      ).to.be.revertedWith('RFQ expired');
    });
  });
});