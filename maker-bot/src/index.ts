#!/usr/bin/env node

import { Command } from 'commander';
import { MakerBot } from './maker.js';
import { PricingEngine } from './pricing.js';
import { log } from './logger.js';

const program = new Command();

program
  .name('cloakswap-maker')
  .description('Market maker bot for CloakSwap RFQ protocol')
  .version('1.0.0');

program
  .command('monitor')
  .description('Start monitoring and making markets')
  .action(async () => {
    try {
      const bot = new MakerBot();
      await bot.start();
      
      // Keep the process alive
      process.on('SIGINT', () => {
        log('info', 'Received SIGINT, shutting down...');
        bot.stop();
        process.exit(0);
      });

      // Prevent the process from exiting
      setInterval(() => {}, 1000);
    } catch (error) {
      log('error', 'Failed to start maker bot', error);
      process.exit(1);
    }
  });

program
  .command('quote')
  .description('Calculate a quote for testing')
  .requiredOption('--from <symbol>', 'Symbol to trade from (e.g., ETH)')
  .requiredOption('--to <symbol>', 'Symbol to trade to (e.g., USDC)')
  .requiredOption('--amount <amount>', 'Amount to trade (in token units)')
  .action(async (options) => {
    try {
      const pricing = new PricingEngine();
      const amount = BigInt(options.amount);
      
      const quote = await pricing.calculateQuotePrice(
        options.from,
        options.to,
        amount
      );

      log('info', `Quote: ${options.amount} ${options.from} → ${quote.toString()} ${options.to}`);
      
      // Also show individual prices for reference
      const priceFrom = await pricing.getPriceBySymbol(options.from);
      const priceTo = await pricing.getPriceBySymbol(options.to);
      
      log('info', 'Oracle prices', {
        [options.from]: `${priceFrom.price.toString()} (${priceFrom.decimals} decimals)`,
        [options.to]: `${priceTo.price.toString()} (${priceTo.decimals} decimals)`
      });
    } catch (error) {
      log('error', 'Failed to calculate quote', error);
      process.exit(1);
    }
  });

program
  .command('quote-addr')
  .description('Calculate a quote using token addresses')
  .requiredOption('--from <address>', 'Token address to trade from')
  .requiredOption('--to <address>', 'Token address to trade to')
  .requiredOption('--amount <amount>', 'Amount to trade (in token units)')
  .action(async (options) => {
    try {
      const pricing = new PricingEngine();
      const amount = BigInt(options.amount);
      
      const quote = await pricing.calculateQuotePrice(
        options.from,
        options.to,
        amount
      );

      log('info', `Quote: ${options.amount} tokens → ${quote.toString()} tokens`);
      log('info', 'Token addresses', {
        from: options.from,
        to: options.to
      });
    } catch (error) {
      log('error', 'Failed to calculate quote', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show maker bot status')
  .action(async () => {
    try {
      const bot = new MakerBot();
      await bot.getStatus();
    } catch (error) {
      log('error', 'Failed to get status', error);
      process.exit(1);
    }
  });

program
  .command('price')
  .description('Get current oracle price for a symbol')
  .requiredOption('--symbol <symbol>', 'Symbol to get price for (e.g., ETH, USDC)')
  .action(async (options) => {
    try {
      const pricing = new PricingEngine();
      const priceData = await pricing.getPriceBySymbol(options.symbol);
      
      log('success', `${options.symbol} price: ${priceData.price.toString()} (${priceData.decimals} decimals, timestamp: ${priceData.timestamp})`);
    } catch (error) {
      log('error', `Failed to get price for ${options.symbol}`, error);
      process.exit(1);
    }
  });

program
  .command('tokens')
  .description('List supported tokens')
  .action(async () => {
    try {
      const { tokenMapping } = await import('./tokens.js');
      const tokens = tokenMapping.getSupportedTokens();
      
      log('info', 'Supported tokens:');
      tokens.forEach(token => {
        console.log(`  ${token.symbol}: ${token.address} (${token.decimals} decimals, oracle: ${token.oracleSymbol})`);
      });
    } catch (error) {
      log('error', 'Failed to list tokens', error);
      process.exit(1);
    }
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

program.parse();