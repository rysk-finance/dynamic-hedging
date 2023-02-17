export const OptionCatalogueABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_authority",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateralAsset",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "InvalidExpiry",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UNAUTHORIZED",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UnapprovedSeries",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "contract IAuthority",
				"name": "authority",
				"type": "address"
			}
		],
		"name": "AuthorityUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint64",
				"name": "expiration",
				"type": "uint64"
			},
			{
				"indexed": false,
				"internalType": "uint128",
				"name": "strike",
				"type": "uint128"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isPut",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isBuyable",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isSellable",
				"type": "bool"
			}
		],
		"name": "SeriesAltered",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint64",
				"name": "expiration",
				"type": "uint64"
			},
			{
				"indexed": false,
				"internalType": "uint128",
				"name": "strike",
				"type": "uint128"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isPut",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isBuyable",
				"type": "bool"
			},
			{
				"indexed": false,
				"internalType": "bool",
				"name": "isSellable",
				"type": "bool"
			}
		],
		"name": "SeriesApproved",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "oHash",
				"type": "bytes32"
			}
		],
		"name": "approvedOptions",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "authority",
		"outputs": [
			{
				"internalType": "contract IAuthority",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "uint64",
						"name": "expiration",
						"type": "uint64"
					},
					{
						"internalType": "uint128",
						"name": "strike",
						"type": "uint128"
					},
					{
						"internalType": "bool",
						"name": "isPut",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isBuyable",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isSellable",
						"type": "bool"
					}
				],
				"internalType": "struct Types.Option[]",
				"name": "options",
				"type": "tuple[]"
			}
		],
		"name": "changeOptionBuyOrSell",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "collateralAsset",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "expirations",
		"outputs": [
			{
				"internalType": "uint64",
				"name": "",
				"type": "uint64"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "strikePrice",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "collateral",
				"type": "address"
			}
		],
		"name": "formatStrikePrice",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getExpirations",
		"outputs": [
			{
				"internalType": "uint64[]",
				"name": "",
				"type": "uint64[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint64",
				"name": "expiration",
				"type": "uint64"
			},
			{
				"internalType": "bool",
				"name": "isPut",
				"type": "bool"
			}
		],
		"name": "getOptionDetails",
		"outputs": [
			{
				"internalType": "uint128[]",
				"name": "",
				"type": "uint128[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "oHash",
				"type": "bytes32"
			}
		],
		"name": "getOptionStores",
		"outputs": [
			{
				"components": [
					{
						"internalType": "bool",
						"name": "approvedOption",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isBuyable",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isSellable",
						"type": "bool"
					}
				],
				"internalType": "struct OptionCatalogue.OptionStores",
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "oHash",
				"type": "bytes32"
			}
		],
		"name": "isBuyable",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "oHash",
				"type": "bytes32"
			}
		],
		"name": "isSellable",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "uint64",
						"name": "expiration",
						"type": "uint64"
					},
					{
						"internalType": "uint128",
						"name": "strike",
						"type": "uint128"
					},
					{
						"internalType": "bool",
						"name": "isPut",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isBuyable",
						"type": "bool"
					},
					{
						"internalType": "bool",
						"name": "isSellable",
						"type": "bool"
					}
				],
				"internalType": "struct Types.Option[]",
				"name": "options",
				"type": "tuple[]"
			}
		],
		"name": "issueNewSeries",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "optionDetails",
		"outputs": [
			{
				"internalType": "uint128",
				"name": "",
				"type": "uint128"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"name": "optionStores",
		"outputs": [
			{
				"internalType": "bool",
				"name": "approvedOption",
				"type": "bool"
			},
			{
				"internalType": "bool",
				"name": "isBuyable",
				"type": "bool"
			},
			{
				"internalType": "bool",
				"name": "isSellable",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "contract IAuthority",
				"name": "_newAuthority",
				"type": "address"
			}
		],
		"name": "setAuthority",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const
