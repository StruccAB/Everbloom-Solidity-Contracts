import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@typechain/hardhat";
import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades';
import '@nomiclabs/hardhat-etherscan';

require('dotenv').config();

const {
  API_URL,
  PRIVATE_KEY,
  REPORT_GAS,
  POLYGONSCAN_API_KEY,
  PROD_API_URL,
  PROD_PRIVATE_KEY,
} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {},
    polygon: {
      url: PROD_API_URL,
      accounts: [String(PROD_PRIVATE_KEY)]
    },
    matic: {
      url: API_URL,
      accounts: [String(PRIVATE_KEY)]
    }
  },
  gasReporter: {
    enabled: Boolean(REPORT_GAS),
    currency: 'USD',
    token: 'ETH',
    // token: 'MATIC',
    coinmarketcap: 'b2e9c427-1804-44e7-93ce-e92ccc3ebbfe',
    gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice'
    // gasPriceApi: 'https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice'
  },
  etherscan: {
    apiKey: POLYGONSCAN_API_KEY,
  }
};

export default config;
