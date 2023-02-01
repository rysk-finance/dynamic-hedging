export const getAddresses = (network: string) => {
	switch (network) {
		case "arbitrum":
			return {
				UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
				collateralAsset: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC
				underlyingAsset: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
				liquidityPool: "0xC10B976C671Ce9bFf0723611F01422ACbAe100A5",
				poolFee: 3000, // 30 BPS
				priceFeed: "0xA5a095f2a2Beb2d53382293b0FfE0f520dDEC297",
				authority: "0x0c83E447dc7f4045b8717d5321056D4e9E86dCD2"
			}
		case "arbitrumGoerli":
			return {
				UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
				collateralAsset: "0x6775842ae82bf2f0f987b10526768ad89d79536e", // USDC
				underlyingAsset: "0x53320bE2A35649E9B2a0f244f9E9474929d3B699", // WETH
				liquidityPool: "0x2ceDe96cd46C9B751EeB868A57FEDeD060Dbe6Bf",
				poolFee: 3000, // 30 BPS
				priceFeed: "0xDcA6c35228acb82363406CB2e7eee81B40c692aE",
				authority: "0xA524f4F9046a243c67A07dDE2D9477bf320Ed89E"
			}
		default:
			throw new Error(`No addresses for Network: ${network}`)
	}
}
