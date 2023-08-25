export const getAddresses = (network: string) => {
	switch (network) {
		case "arbitrum":
			return {
				catalogue: "0x44227Dc2a1d71FC07DC254Dfd42B1C44aFF12168",
				usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
				weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
				pricer: "0xeA5Fb118862876f249Ff0b3e7fb25fEb38158def",
				protocol: "0x4e920e9A901069d9b211646B6E191d81BA40E5FB",
				exchange: "0xC117bf3103bd09552F9a721F0B8Bce9843aaE1fa",
				liquidityPool: "0x217749d9017cB87712654422a1F5856AAA147b80"
			}
		case "arbitrumGoerli":
			return {
				catalogue: "0xde458dD32651F27A8895D4a92B7798Cdc4EbF2f0",
				usdc: "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d", // USDC
				weth: "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3", // WETH
				pricer: "0xc939df369C0Fc240C975A6dEEEE77d87bCFaC259",
				protocol: "0x81267CBE2d605b7Ae2328462C1EAF51a1Ab57fFd",
				exchange: "0xb672fE86693bF6f3b034730f5d2C77C8844d6b45",
				liquidityPool: "0x0B1Bf5fb77AA36cD48Baa1395Bc2B5fa0f135d8C"
			}
		default:
			throw new Error(`No addresses for Network: ${network}`)
	}
}