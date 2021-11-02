import * as dotenv from 'dotenv';
import { Wallet } from "@ethersproject/wallet";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "hardhat-deploy";
import "hardhat-typechain";
import "hardhat-gas-reporter";
import "hardhat-contract-sizer";
import path from 'path';

const ethers = require('ethers');
const bip39 = require("bip39");
dotenv.config({ path: __dirname+'/.env' });



const mnemonic = process.env.TEST_MNEMONIC || bip39.generateMnemonic();

let accounts;
let hardhatEvmAccounts;
if (mnemonic) {
    accounts = {
        mnemonic,
    };
    hardhatEvmAccounts = [];
    for (let i = 0; i < 10; i++) {
        const wallet = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/" + i);
        hardhatEvmAccounts.push({
            privateKey: wallet.privateKey,
            balance: "1000000000000000000000",
        });
    }
}
const ropsten =
    process.env.ROPSTEN ||
    new ethers.providers.InfuraProvider("ropsten").connection.url;

module.exports = {
    typechain: {
        outDir: "types",
        target: "ethers-v5",
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false,
    },
    solidity: {
        compilers: [
            {
                version: "0.6.8",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            },
            {
                version: "0.8.9",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200
                    }
                }
            }
        ]
    },
    namedAccounts: {
        deployer: 0,
        admin: "0xA0b4E98dB8Be8A3a6D8506dD5f3a826855633cb3",
    },
    networks: {
        hardhat: {
            accounts: hardhatEvmAccounts,
            gas: 12000000,
            blockGasLimit: 0x1fffffffffffff,
            allowUnlimitedContractSize: true
        },
        ropsten: {
            url: ropsten,
            accounts,
            chainId: 3,
        }
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN
    },
    gasReporter: {
        currency: 'USD',
        gasPrice: 44,
        enabled: (process.env.REPORT_GAS) ? true : false,
        onlyCalledMethods: true
    },
    paths: {
        sources: path.join(__dirname, "contracts"),
        tests: path.join(__dirname, "test"),
        cache: path.join(__dirname, "cache"),
        artifacts: path.join(__dirname, "artifacts"),
        deploy: path.join(__dirname, "deploy"),
        deployments: path.join(__dirname, "deployments"),
    }
};
