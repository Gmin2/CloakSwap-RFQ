import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ABIs from compiled artifacts
function loadABI(contractPath: string) {
  const abiPath = path.join(__dirname, '../../artifacts/contracts', contractPath);
  const artifact = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
  return artifact.abi;
}

export const FTSO_READER_ABI = loadABI('flare/FTSOReader.sol/FTSOReader.json');
export const RNG_READER_ABI = loadABI('flare/RNGReader.sol/RNGReader.json');
export const QUOTE_BOOK_ABI = loadABI('lisk/QuoteBook.sol/QuoteBook.json');