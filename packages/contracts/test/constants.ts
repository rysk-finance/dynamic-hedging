// Contract address storage

export enum CHAINID {
	ETH_MAINNET = 1, // eslint-disable-line no-unused-vars
	ETH_KOVAN = 42, // eslint-disable-line no-unused-vars
	ARBITRUM = 42161, // eslint-disable-line no-unused-vars
	ARBITRUM_GOERLI = 421613, // eslint-disable-line no-unused-vars
	AVAX_MAINNET = 43114, // eslint-disable-line no-unused-vars
	AVAX_FUJI = 43113, // eslint-disable-line no-unused-vars
	ARBITRUM = 42161
}

/**
 * Tokens and owners
 */
export const WETH_ADDRESS = {
	[CHAINID.ETH_MAINNET]: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
	[CHAINID.ARBITRUM]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
}

export const USDC_ADDRESS = {
	[CHAINID.ETH_MAINNET]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	[CHAINID.ARBITRUM]: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
}

export const USDC_OWNER_ADDRESS = {
	[CHAINID.ETH_MAINNET]: "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503"
}

/**
 * Oracles
 */
export const ETH_PRICE_ORACLE = {
	[CHAINID.ETH_MAINNET]: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
	[CHAINID.ARBITRUM]: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612" // chainlink price feed
}

export const USDC_PRICE_ORACLE = {
	[CHAINID.ETH_MAINNET]: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
	[CHAINID.ARBITRUM]: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3" // chainlink price feed
}

export const CHAINLINK_WETH_PRICER = {
	[CHAINID.ETH_MAINNET]: "0x128cE9B4D97A6550905dE7d9Abc2b8C747b0996C",
	[CHAINID.ARBITRUM]: "0x6a1F5eF89Bd6CB297BeDEEEbff3308d240dBa99E" // opyn pricer contract
}

/**
 * Opyn
 */
export const OTOKEN_FACTORY = {
	[CHAINID.ETH_MAINNET]: "0x7C06792Af1632E77cb27a558Dc0885338F4Bdf8E",
	[CHAINID.ARBITRUM]: "0xBa1952eCdbA02de66fCf73f29068e8cf072644ec"
}

export const MARGIN_POOL = {
	[CHAINID.ETH_MAINNET]: "0x5934807cC0654d46755eBd2848840b616256C6Ef",
	[CHAINID.ARBITRUM]: "0xb9F33349db1d0711d95c1198AcbA9511B8269626"
}

export const GAMMA_ORACLE = {
	[CHAINID.ETH_MAINNET]: "0x789cD7AB3742e23Ce0952F6Bc3Eb3A73A0E08833",
	[CHAINID.ARBITRUM]: "0xBA1880CFFE38DD13771CB03De896460baf7dA1E7"
}

export const GAMMA_ORACLE_NEW = {
	[CHAINID.ETH_MAINNET]: "0x789cD7AB3742e23Ce0952F6Bc3Eb3A73A0E08833", // New oracle
	[CHAINID.ARBITRUM]: "0xBA1880CFFE38DD13771CB03De896460baf7dA1E7"
}

export const GAMMA_WHITELIST = {
	[CHAINID.ETH_MAINNET]: "0xa5EA18ac6865f315ff5dD9f1a7fb1d41A30a6779",
	[CHAINID.ARBITRUM]: "0x84CaCC4103CeE1Da9b79f9Ed0Ed97414240D9c6F"
}

export const GAMMA_WHITELIST_OWNER = {
	[CHAINID.ETH_MAINNET]: "0x638E5DA0EEbbA58c67567bcEb4Ab2dc8D34853FB"
}

export const GAMMA_CONTROLLER = {
	[CHAINID.ETH_MAINNET]: "0x4ccc2339F87F6c59c6893E1A678c2266cA58dC72"
}

export const ORACLE_OWNER = {
	[CHAINID.ETH_MAINNET]: "0x2FCb2fc8dD68c48F406825255B4446EDFbD3e140",
	[CHAINID.ARBITRUM]: "0xfbde2e477ed031f54ed5ad52f35ee43cd82cf2a6"
}

export const UNISWAP_V3_SWAP_ROUTER = {
	[CHAINID.ETH_MAINNET]: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
	[CHAINID.ARBITRUM]: "0xE592427A0AEce92De3Edee1F18E0157C05861564"
}

export const CONTROLLER_OWNER = {
	[CHAINID.ETH_MAINNET]: "0x638E5DA0EEbbA58c67567bcEb4Ab2dc8D34853FB",
	[CHAINID.ARBITRUM]: "0xfbde2e477ed031f54ed5ad52f35ee43cd82cf2a6"
}

export const ADDRESS_BOOK_OWNER = {
	[CHAINID.ETH_MAINNET]: "0x638E5DA0EEbbA58c67567bcEb4Ab2dc8D34853FB"
}

export const ADDRESS_BOOK = {
	[CHAINID.ETH_MAINNET]: "0x1E31F2DCBad4dc572004Eae6355fB18F9615cBe4",
	[CHAINID.ARBITRUM]: "0xCa19F26c52b11186B4b1e76a662a14DA5149EA5a"
}
export const ORACLE_DISPUTE_PERIOD = 7200
export const ORACLE_LOCKING_PERIOD = 300
export const oTokenDecimalShift18 = 10000000000
/**
 * Uniswap
 */
// Factory is deployed to same address on all networks
export const UNISWAP_V3_FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984"
