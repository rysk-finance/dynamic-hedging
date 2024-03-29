export const AlphaPortfolioValuesFeedABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_authority",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_maxNetDhvExposure",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_protocol",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "ExchangeNotPaused",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "IncorrectSeriesToRemove",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "MaxNetDhvExposureExceeded",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NoShortPositions",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NoVaultForShortPositions",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotKeeper",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "index",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			}
		],
		"name": "OptionHasExpiredInStores",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "PRBMathSD59x18__AbsInputTooSmall",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "prod1",
				"type": "uint256"
			}
		],
		"name": "PRBMath__MulDivFixedPointOverflow",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "prod1",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "denominator",
				"type": "uint256"
			}
		],
		"name": "PRBMath__MulDivOverflow",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "SeriesNotExpired",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UNAUTHORIZED",
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
				"indexed": true,
				"internalType": "address",
				"name": "underlying",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "strike",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "delta",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "gamma",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "vega",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "theta",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "callPutsValue",
				"type": "int256"
			}
		],
		"name": "DataFullfilled",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "maxNetDhvExposure",
				"type": "uint256"
			}
		],
		"name": "MaxNetDhvExposureUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "optionHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "oldNetDhvExposure",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "newNetDhvExposure",
				"type": "int256"
			}
		],
		"name": "NetDhvExposureChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "_underlying",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			}
		],
		"name": "RequestedUpdate",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "shortExposure",
				"type": "int256"
			},
			{
				"indexed": false,
				"internalType": "int256",
				"name": "longExposure",
				"type": "int256"
			},
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
						"internalType": "address",
						"name": "underlying",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "strikeAsset",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "collateral",
						"type": "address"
					}
				],
				"indexed": false,
				"internalType": "struct Types.OptionSeries",
				"name": "optionSeries",
				"type": "tuple"
			}
		],
		"name": "StoresUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_series",
				"type": "address"
			}
		],
		"name": "accountLiquidatedSeries",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_i",
				"type": "uint256"
			}
		],
		"name": "addressAtIndexInSet",
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
		"inputs": [],
		"name": "addressSetLength",
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
				"internalType": "address",
				"name": "_series",
				"type": "address"
			}
		],
		"name": "cleanLooperManually",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strikeAsset",
				"type": "address"
			}
		],
		"name": "fulfill",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getAddressSet",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "strike",
				"type": "address"
			}
		],
		"name": "getPortfolioValues",
		"outputs": [
			{
				"components": [
					{
						"internalType": "int256",
						"name": "delta",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "gamma",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "vega",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "theta",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "callPutsValue",
						"type": "int256"
					},
					{
						"internalType": "uint256",
						"name": "timestamp",
						"type": "uint256"
					},
					{
						"internalType": "uint256",
						"name": "spotPrice",
						"type": "uint256"
					}
				],
				"internalType": "struct Types.PortfolioValues",
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
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "handler",
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
				"internalType": "address",
				"name": "_a",
				"type": "address"
			}
		],
		"name": "isAddressInSet",
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
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "keeper",
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
		"name": "liquidityPool",
		"outputs": [
			{
				"internalType": "contract ILiquidityPool",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "maxNetDhvExposure",
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
		"inputs": [
			{
				"internalType": "contract IPortfolioValuesFeed",
				"name": "_migrateContract",
				"type": "address"
			}
		],
		"name": "migrate",
		"outputs": [],
		"stateMutability": "nonpayable",
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
		"name": "netDhvExposure",
		"outputs": [
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "protocol",
		"outputs": [
			{
				"internalType": "contract Protocol",
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
				"internalType": "address",
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			}
		],
		"name": "requestPortfolioData",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "id",
				"type": "bytes32"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "rfr",
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
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_handler",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_auth",
				"type": "bool"
			}
		],
		"name": "setHandler",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_keeper",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_auth",
				"type": "bool"
			}
		],
		"name": "setKeeper",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_liquidityPool",
				"type": "address"
			}
		],
		"name": "setLiquidityPool",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_maxNetDhvExposure",
				"type": "uint256"
			}
		],
		"name": "setMaxNetDhvExposure",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32[]",
				"name": "_optionHashes",
				"type": "bytes32[]"
			},
			{
				"internalType": "int256[]",
				"name": "_netDhvExposures",
				"type": "int256[]"
			}
		],
		"name": "setNetDhvExposures",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_rfr",
				"type": "uint256"
			}
		],
		"name": "setRFR",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "storesForAddress",
		"outputs": [
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
						"internalType": "address",
						"name": "underlying",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "strikeAsset",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "collateral",
						"type": "address"
					}
				],
				"internalType": "struct Types.OptionSeries",
				"name": "optionSeries",
				"type": "tuple"
			},
			{
				"internalType": "int256",
				"name": "shortExposure",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "longExposure",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "syncLooper",
		"outputs": [],
		"stateMutability": "nonpayable",
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
						"internalType": "address",
						"name": "underlying",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "strikeAsset",
						"type": "address"
					},
					{
						"internalType": "address",
						"name": "collateral",
						"type": "address"
					}
				],
				"internalType": "struct Types.OptionSeries",
				"name": "_optionSeries",
				"type": "tuple"
			},
			{
				"internalType": "int256",
				"name": "shortExposure",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "longExposure",
				"type": "int256"
			},
			{
				"internalType": "address",
				"name": "_seriesAddress",
				"type": "address"
			}
		],
		"name": "updateStores",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const;
