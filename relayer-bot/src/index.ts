#!/usr/bin/env node

import { Command } from 'commander';
import { selectBestQuote } from './selector.js';
import { log } from './logger.js';
import { cfg } from './config.js';

const program = new Command();

program
  .name('cloakswap-relayer')
  .description('Cross-chain relayer for CloakSwap RFQ protocol')
  .version('1.0.0');

program
  .command('select')
  .description('Select best quote for an RFQ using Flare oracles')
  .requiredOption('--rfq <id>', 'RFQ ID to process')
  .option('--symbol <symbol>', 'Price symbol for FTSO', cfg.symbol)
  .action(async (options) => {
    try {
      log('info', 'Starting quote selection...', {
        rfqId: options.rfq,
        symbol: options.symbol,
        account: cfg.privateKey.slice(0, 6) + '...',
      });
      
      const result = await selectBestQuote(parseInt(options.rfq), options.symbol);
      
      log('success', 'Quote selection completed successfully!', result);
      process.exit(0);
      
    } catch (error) {
      log('error', 'Quote selection failed', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log('Current configuration:');
    console.log(JSON.stringify({
      ...cfg,
      privateKey: cfg.privateKey.slice(0, 6) + '...',
    }, null, 2));
  });

if (process.argv.length < 3) {
  program.help();
}

program.parse();