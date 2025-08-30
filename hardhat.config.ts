import { config as dotenv } from "dotenv"; dotenv();
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PK = process.env.PRIVATE_KEY!;
const config: HardhatUserConfig = {
  solidity: { version: "0.8.27", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    liskSepolia: { url: process.env.LISK_SEPOLIA_RPC!, chainId: 4202, accounts: PK ? [PK] : [] },
    coston2:     { url: process.env.FLARE_COSTON2_RPC!, chainId: 114,  accounts: PK ? [PK] : [] }
  }
};
export default config;