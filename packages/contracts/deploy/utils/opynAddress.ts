export const getAddresses = (network: string) => {
	switch (network) {
		case "arbitrum":
			return {
				addressBook: "0xCa19F26c52b11186B4b1e76a662a14DA5149EA5a",
				usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
				weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
				exchange: "0xC117bf3103bd09552F9a721F0B8Bce9843aaE1fa",
				controller: "0x594bD4eC29F7900AE29549c140Ac53b5240d4019",
                oracle: "0xBA1880CFFE38DD13771CB03De896460baf7dA1E7",
                feeRecipient: "0xB2dc03Adde4cA78c9FD13b789d48a06Abe8d3cDC"
			}
		case "arbitrumGoerli":
			return {
				addressBook: "0xd6e67bF0b1Cdb34C37f31A2652812CB30746a94A",
				usdc: "0x408c5755b5c7a0a28D851558eA3636CfC5b5b19d", // USDC
				weth: "0x3b3a1dE07439eeb04492Fa64A889eE25A130CDd3", // WETH
				exchange: "0xb672fE86693bF6f3b034730f5d2C77C8844d6b45",
				controller: "0x11a602a5F5D823c103bb8b7184e22391Aae5F4C2",
                oracle: "0x35578F5A49E1f1Cf34ed780B46A0BdABA23D4C0b",
                feeRecipient : "0xAf7f68c50de6dd885d91ceD7A6572Ed764d6A0B8"
			}
		default:
			throw new Error(`No addresses for Network: ${network}`)
	}
}