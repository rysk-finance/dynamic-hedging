export const LiquidityPoolABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_protocol",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strikeAsset",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_underlyingAsset",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateralAsset",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "rfr",
				"type": "uint256"
			},
			{
				"internalType": "string",
				"name": "name",
				"type": "string"
			},
			{
				"internalType": "string",
				"name": "symbol",
				"type": "string"
			},
			{
				"components": [
					{
						"internalType": "uint128",
						"name": "minCallStrikePrice",
						"type": "uint128"
					},
					{
						"internalType": "uint128",
						"name": "maxCallStrikePrice",
						"type": "uint128"
					},
					{
						"internalType": "uint128",
						"name": "minPutStrikePrice",
						"type": "uint128"
					},
					{
						"internalType": "uint128",
						"name": "maxPutStrikePrice",
						"type": "uint128"
					},
					{
						"internalType": "uint128",
						"name": "minExpiry",
						"type": "uint128"
					},
					{
						"internalType": "uint128",
						"name": "maxExpiry",
						"type": "uint128"
					}
				],
				"internalType": "struct Types.OptionParams",
				"name": "_optionParams",
				"type": "tuple"
			},
			{
				"internalType": "address",
				"name": "_authority",
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
		"name": "InvalidAddress",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidDecimals",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidShareAmount",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "IssuanceFailed",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "LiabilitiesGreaterThanAssets",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "MaxLiquidityBufferReached",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotHandler",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "NotKeeper",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OptionExpiryInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OptionStrikeInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "ReactorAlreadyExists",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "StrikeAssetInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TradingNotPaused",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "TradingPaused",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UNAUTHORIZED",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "UnderlyingAssetInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "WithdrawExceedsLiquidity",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Approval",
		"type": "event"
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
				"internalType": "address",
				"name": "series",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
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
				"name": "escrowReturned",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "seller",
				"type": "address"
			}
		],
		"name": "BuybackOption",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "epoch",
				"type": "uint256"
			}
		],
		"name": "Deposit",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "epoch",
				"type": "uint256"
			}
		],
		"name": "DepositEpochExecuted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "epoch",
				"type": "uint256"
			}
		],
		"name": "InitiateWithdraw",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "Paused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "int256",
				"name": "deltaChange",
				"type": "int256"
			}
		],
		"name": "RebalancePortfolioDelta",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "epoch",
				"type": "uint256"
			}
		],
		"name": "Redeem",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "series",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "collateralReturned",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "collateralLost",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "closer",
				"type": "address"
			}
		],
		"name": "SettleVault",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [],
		"name": "TradingPaused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [],
		"name": "TradingUnpaused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "Transfer",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "Unpaused",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "shares",
				"type": "uint256"
			}
		],
		"name": "Withdraw",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "epoch",
				"type": "uint256"
			}
		],
		"name": "WithdrawalEpochExecuted",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "address",
				"name": "series",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "amount",
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
				"name": "escrow",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "address",
				"name": "buyer",
				"type": "address"
			}
		],
		"name": "WriteOption",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "DOMAIN_SEPARATOR",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "lpCollateralDifference",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "addToLpBalance",
				"type": "bool"
			}
		],
		"name": "adjustCollateral",
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
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "allowance",
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
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "approve",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
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
				"name": "",
				"type": "address"
			}
		],
		"name": "balanceOf",
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
		"name": "bufferPercentage",
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
				"internalType": "address",
				"name": "_handler",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "auth",
				"type": "bool"
			}
		],
		"name": "changeHandler",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "checkBuffer",
		"outputs": [
			{
				"internalType": "int256",
				"name": "bufferRemaining",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "collateralAllocated",
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
		"inputs": [],
		"name": "collateralCap",
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
		"name": "completeWithdraw",
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
		"inputs": [],
		"name": "decimals",
		"outputs": [
			{
				"internalType": "uint8",
				"name": "",
				"type": "uint8"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_amount",
				"type": "uint256"
			}
		],
		"name": "deposit",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "depositEpoch",
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
		"name": "depositEpochPricePerShare",
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
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "depositReceipts",
		"outputs": [
			{
				"internalType": "uint128",
				"name": "epoch",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "amount",
				"type": "uint128"
			},
			{
				"internalType": "uint256",
				"name": "unredeemedShares",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "ephemeralDelta",
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
		"name": "ephemeralLiabilities",
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
		"name": "executeEpochCalculation",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getAssets",
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
				"internalType": "address",
				"name": "asset",
				"type": "address"
			}
		],
		"name": "getBalance",
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
		"name": "getExternalDelta",
		"outputs": [
			{
				"internalType": "int256",
				"name": "externalDelta",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getHedgingReactors",
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
				"internalType": "bool",
				"name": "isPut",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "underlyingPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "strikePrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "expiration",
				"type": "uint256"
			}
		],
		"name": "getImpliedVolatility",
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
		"name": "getNAV",
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
		"name": "getPortfolioDelta",
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
		"name": "getVolatilityFeed",
		"outputs": [
			{
				"internalType": "contract VolatilityFeed",
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
				"internalType": "contract IOptionRegistry",
				"name": "optionRegistry",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "premium",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "delta",
				"type": "int256"
			},
			{
				"internalType": "address",
				"name": "seller",
				"type": "address"
			}
		],
		"name": "handlerBuybackOption",
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
				"name": "optionSeries",
				"type": "tuple"
			}
		],
		"name": "handlerIssue",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
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
				"name": "premium",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "delta",
				"type": "int256"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			}
		],
		"name": "handlerIssueAndWriteOption",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "",
				"type": "address"
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
				"name": "optionSeries",
				"type": "tuple"
			},
			{
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			},
			{
				"internalType": "contract IOptionRegistry",
				"name": "optionRegistry",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "premium",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "delta",
				"type": "int256"
			},
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			}
		],
		"name": "handlerWriteOption",
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
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "hedgingReactors",
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
				"name": "_shares",
				"type": "uint256"
			}
		],
		"name": "initiateWithdraw",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "isTradingPaused",
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
		"name": "maxPriceDeviationThreshold",
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
		"name": "maxTimeDeviationThreshold",
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
		"name": "name",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
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
		"name": "nonces",
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
		"name": "optionParams",
		"outputs": [
			{
				"internalType": "uint128",
				"name": "minCallStrikePrice",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "maxCallStrikePrice",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "minPutStrikePrice",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "maxPutStrikePrice",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "minExpiry",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "maxExpiry",
				"type": "uint128"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "partitionedFunds",
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
		"name": "pause",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "pauseTradingAndRequest",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bool",
				"name": "_pause",
				"type": "bool"
			}
		],
		"name": "pauseUnpauseTrading",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "paused",
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
		"name": "pendingDeposits",
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
		"name": "pendingWithdrawals",
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
				"internalType": "address",
				"name": "owner",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "spender",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "deadline",
				"type": "uint256"
			},
			{
				"internalType": "uint8",
				"name": "v",
				"type": "uint8"
			},
			{
				"internalType": "bytes32",
				"name": "r",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "s",
				"type": "bytes32"
			}
		],
		"name": "permit",
		"outputs": [],
		"stateMutability": "nonpayable",
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
				"internalType": "int256",
				"name": "delta",
				"type": "int256"
			},
			{
				"internalType": "uint256",
				"name": "reactorIndex",
				"type": "uint256"
			}
		],
		"name": "rebalancePortfolioDelta",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_shares",
				"type": "uint256"
			}
		],
		"name": "redeem",
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
				"internalType": "uint256",
				"name": "_index",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "_override",
				"type": "bool"
			}
		],
		"name": "removeHedgingReactorAddress",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "resetEphemeralValues",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "riskFreeRate",
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
				"internalType": "uint256",
				"name": "_bufferPercentage",
				"type": "uint256"
			}
		],
		"name": "setBufferPercentage",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_collateralCap",
				"type": "uint256"
			}
		],
		"name": "setCollateralCap",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_reactorAddress",
				"type": "address"
			}
		],
		"name": "setHedgingReactorAddress",
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
				"internalType": "uint256",
				"name": "_maxPriceDeviationThreshold",
				"type": "uint256"
			}
		],
		"name": "setMaxPriceDeviationThreshold",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_maxTimeDeviationThreshold",
				"type": "uint256"
			}
		],
		"name": "setMaxTimeDeviationThreshold",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint128",
				"name": "_newMinCallStrike",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "_newMaxCallStrike",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "_newMinPutStrike",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "_newMaxPutStrike",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "_newMinExpiry",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "_newMaxExpiry",
				"type": "uint128"
			}
		],
		"name": "setNewOptionParams",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_riskFreeRate",
				"type": "uint256"
			}
		],
		"name": "setRiskFreeRate",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "seriesAddress",
				"type": "address"
			}
		],
		"name": "settleVault",
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
		"inputs": [],
		"name": "symbol",
		"outputs": [
			{
				"internalType": "string",
				"name": "",
				"type": "string"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "totalSupply",
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
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transfer",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "from",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "to",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "transferFrom",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
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
	},
	{
		"inputs": [],
		"name": "unpause",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "withdrawalEpoch",
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
		"name": "withdrawalEpochPricePerShare",
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
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "withdrawalReceipts",
		"outputs": [
			{
				"internalType": "uint128",
				"name": "epoch",
				"type": "uint128"
			},
			{
				"internalType": "uint128",
				"name": "shares",
				"type": "uint128"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
] as const;
