import { Wallet } from "@ethersproject/wallet"
import "@nomiclabs/hardhat-ethers"
import "@nomiclabs/hardhat-etherscan"
import "@typechain/hardhat"
import "@nomicfoundation/hardhat-chai-matchers"
import * as dotenv from "dotenv"
import "hardhat-contract-sizer"
import "hardhat-dependency-compiler"
import "hardhat-deploy"
import "hardhat-gas-reporter"
import path from "path"
import "solidity-coverage"
// Task imports
import "./tasks/seedUSDC"
// import "./tasks/executeEpoch"

const ethers = require("ethers")
const bip39 = require("bip39")
dotenv.config({ path: __dirname + "/.env" })

const mnemonic = process.env.TEST_MNEMONIC || bip39.generateMnemonic()

let accounts
let hardhatEvmAccounts
if (mnemonic) {
	accounts = {
		mnemonic
	}
	hardhatEvmAccounts = []
	for (let i = 0; i < 10; i++) {
		const wallet = Wallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/" + i)
		hardhatEvmAccounts.push({
			privateKey: wallet.privateKey,
			balance: "1000000000000000000000"
		})
	}
}

const UNISWAP_COMPILER_SETTINGS = {
	version: "0.7.6",
	settings: {
		evmVersion: "istanbul",
		optimizer: {
			enabled: true,
			runs: 1_000_000
		},
		metadata: {
			bytecodeHash: "none"
		}
	}
}

module.exports = {
	typechain: {
		outDir: "types",
		target: "ethers-v5"
	},
	contractSizer: {
		alphaSort: false,
		runOnCompile: true,
		disambiguatePaths: false
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
				version: "0.6.10",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					}
				}
			},
			UNISWAP_COMPILER_SETTINGS,
			{
				version: "0.8.9",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					}
				}
			},
			{
				version: "0.8.10",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					}
				}
			},
			{
				version: "0.8.12",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					}
				}
			},
			{
				version: "0.8.14",
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
		admin: "0xA0b4E98dB8Be8A3a6D8506dD5f3a826855633cb3"
	},
	networks: {
		mainnetFork: {
			chainId: 1,
			url: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY}`,
			forking: {
				blockNumber: 12821000
			}
		},
		hardhat: {
			gas: 12000000,
			blockGasLimit: 0x1fffffffffffff,
			allowUnlimitedContractSize: true,
			chainId: 1337
		},
		arbitrum: {
      url: 'https://arb1.arbitrum.io/rpc',
			chainId: 42161,
			saveDeployments: true,
			accounts: process.env.MAINNET_PRIVATE_KEY ? [process.env.MAINNET_PRIVATE_KEY] : accounts,
			gas: 500000000
		},
		arbitrumGoerli: {
			url: `https://goerli-rollup.arbitrum.io/rpc`,
			chainId: 421613,
			saveDeployments: true,
			accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : accounts,
			gas: 500000000
		}
	},
	etherscan: {
		apiKey: {
			arbitrumGoerli: process.env.ARBISCAN_API_KEY
		},
		customChains: [
			{
				network: "arbitrumGoerli",
				chainId: 421613,
				urls: {
					apiURL: "https://api-goerli.arbiscan.io/api",
					browserURL: "https://goerli.arbiscan.io"
				}
			}
		]
	},
	gasReporter: {
		currency: "USD",
		gasPrice: 44
	},
	paths: {
		sources: path.join(__dirname, "contracts"),
		tests: path.join(__dirname, "test"),
		cache: path.join(__dirname, "cache"),
		artifacts: path.join(__dirname, "artifacts"),
		deploy: path.join(__dirname, "deploy"),
		deployments: path.join(__dirname, "deployments")
	},
	mocha: {
		timeout: 100000
	},
	dependencyCompiler: {
		paths: [
			"@rage/core/contracts/protocol/RageTradeFactory.sol",
			"@rage/core/contracts/protocol/clearinghouse/ClearingHouse.sol",
			"@rage/core/contracts/protocol/insurancefund/InsuranceFund.sol",
			"@rage/core/contracts/protocol/tokens/VToken.sol",
			"@rage/core/contracts/protocol/tokens/VQuote.sol",
			"@rage/core/contracts/protocol/wrapper/VPoolWrapper.sol",
			"@rage/core/contracts/extsloads/ClearingHouseExtsload.sol",
			"@rage/core/contracts/lens/ClearingHouseLens.sol"
		]
		// turn on for slither
		// keep: true,
	}
}
