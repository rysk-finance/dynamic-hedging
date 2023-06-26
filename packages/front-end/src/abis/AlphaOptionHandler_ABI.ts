export const AlphaOptionHandlerABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_authority",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_protocol",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_liquidityPool",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "CollateralAssetInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidBuyer",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidOrder",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidPrice",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NonWhitelistedOtoken",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OrderExpired",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OrderExpiryTooLong",
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
		"inputs": [],
		"name": "SpotMovedBeyondRange",
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
				"indexed": false,
				"internalType": "uint256",
				"name": "feePerContract",
				"type": "uint256"
			}
		],
		"name": "FeePerContractUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "feeRecipient",
				"type": "address"
			}
		],
		"name": "FeeRecipientUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "series",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "optionAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "premium",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "fee",
				"type": "uint256"
			}
		],
		"name": "OptionsBought",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "series",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "optionAmount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "premium",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "fee",
				"type": "uint256"
			}
		],
		"name": "OptionsSold",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "orderId",
				"type": "uint256"
			}
		],
		"name": "OrderCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "orderId",
				"type": "uint256"
			}
		],
		"name": "OrderExecuted",
		"type": "event"
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
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_orderExpiry",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_buyerAddress",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isBuyBack",
				"type": "bool"
			},
			{
				"internalType": "uint256[2]",
				"name": "_spotMovementRange",
				"type": "uint256[2]"
			}
		],
		"name": "createOrder",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
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
				"name": "_optionSeriesCall",
				"type": "tuple"
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
				"internalType": "struct Types.OptionSeries",
				"name": "_optionSeriesPut",
				"type": "tuple"
			},
			{
				"internalType": "uint256",
				"name": "_amountCall",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_amountPut",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_priceCall",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_pricePut",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_orderExpiry",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "_buyerAddress",
				"type": "address"
			},
			{
				"internalType": "uint256[2]",
				"name": "_callSpotMovementRange",
				"type": "uint256[2]"
			},
			{
				"internalType": "uint256[2]",
				"name": "_putSpotMovementRange",
				"type": "uint256[2]"
			}
		],
		"name": "createStrangle",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_orderId",
				"type": "uint256"
			}
		],
		"name": "executeBuyBackOrder",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_orderId",
				"type": "uint256"
			}
		],
		"name": "executeOrder",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_orderId1",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_orderId2",
				"type": "uint256"
			}
		],
		"name": "executeStrangle",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "feePerContract",
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
		"name": "feeRecipient",
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
		"name": "orderIdCounter",
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
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "orderStores",
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
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "price",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "orderExpiry",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			},
			{
				"internalType": "uint128",
				"name": "lowerSpotMovementRange",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "upperSpotMovementRange",
				"type": "uint128"
			},
			{
				"internalType": "bool",
				"name": "isBuyBack",
				"type": "bool"
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
				"internalType": "uint256",
				"name": "_feePerContract",
				"type": "uint256"
			}
		],
		"name": "setFeePerContract",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_feeRecipient",
				"type": "address"
			}
		],
		"name": "setFeeRecipient",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "strikeAsset",
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
				"internalType": "address",
				"name": "optionExchange",
				"type": "address"
			},
			{
				"internalType": "address[]",
				"name": "otokens",
				"type": "address[]"
			}
		],
		"name": "transferOtokens",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "underlyingAsset",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
] as const;
