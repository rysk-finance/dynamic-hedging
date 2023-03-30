export const BeyondPricerABI = [
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
			},
			{
				"internalType": "address",
				"name": "_addressBook",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_slippageGradient",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_deltaBandWidth",
				"type": "uint256"
			},
			{
				"internalType": "uint256[]",
				"name": "_callSlippageGradientMultipliers",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256[]",
				"name": "_putSlippageGradientMultipliers",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256",
				"name": "_collateralLendingRate",
				"type": "uint256"
			},
			{
				"components": [
					{
						"internalType": "int256",
						"name": "sellLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "sellShort",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyShort",
						"type": "int256"
					}
				],
				"internalType": "struct BeyondPricer.DeltaBorrowRates",
				"name": "_deltaBorrowRates",
				"type": "tuple"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [],
		"name": "IVNotFound",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidSlippageGradientMultiplierValue",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "InvalidSlippageGradientMultipliersArrayLength",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "OptionExpiryInvalid",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "PRBMathSD59x18__AbsInputTooSmall",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "PRBMathSD59x18__DivInputTooSmall",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "rAbs",
				"type": "uint256"
			}
		],
		"name": "PRBMathSD59x18__DivOverflow",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "int256",
				"name": "x",
				"type": "int256"
			}
		],
		"name": "PRBMathSD59x18__Exp2InputTooBig",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "int256",
				"name": "x",
				"type": "int256"
			}
		],
		"name": "PRBMathSD59x18__LogInputTooSmall",
		"type": "error"
	},
	{
		"inputs": [],
		"name": "PRBMathSD59x18__MulInputTooSmall",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "rAbs",
				"type": "uint256"
			}
		],
		"name": "PRBMathSD59x18__MulOverflow",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "x",
				"type": "uint256"
			}
		],
		"name": "PRBMathUD60x18__Exp2InputTooBig",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "x",
				"type": "uint256"
			}
		],
		"name": "PRBMathUD60x18__LogInputTooSmall",
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
				"name": "newBidAskIVSpread",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldBidAskIVSpread",
				"type": "uint256"
			}
		],
		"name": "BidAskIVSpreadChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newCollateralLendingRate",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldCollateralLendingRate",
				"type": "uint256"
			}
		],
		"name": "CollateralLendingRateChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newDeltaBandWidth",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldDeltaBandWidth",
				"type": "uint256"
			}
		],
		"name": "DeltaBandWidthChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"components": [
					{
						"internalType": "int256",
						"name": "sellLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "sellShort",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyShort",
						"type": "int256"
					}
				],
				"indexed": false,
				"internalType": "struct BeyondPricer.DeltaBorrowRates",
				"name": "newDeltaBorrowRates",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "int256",
						"name": "sellLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "sellShort",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyShort",
						"type": "int256"
					}
				],
				"indexed": false,
				"internalType": "struct BeyondPricer.DeltaBorrowRates",
				"name": "oldDeltaBorrowRates",
				"type": "tuple"
			}
		],
		"name": "DeltaBorrowRatesChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newFeePerContract",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldFeePerContract",
				"type": "uint256"
			}
		],
		"name": "FeePerContractChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newRiskFreeRate",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldRiskFreeRate",
				"type": "uint256"
			}
		],
		"name": "RiskFreeRateChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newSlippageGradient",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldSlippageGradient",
				"type": "uint256"
			}
		],
		"name": "SlippageGradientChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [],
		"name": "SlippageGradientMultipliersChanged",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "addressBook",
		"outputs": [
			{
				"internalType": "contract AddressBookInterface",
				"name": "",
				"type": "address"
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
		"inputs": [],
		"name": "bidAskIVSpread",
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
		"name": "callSlippageGradientMultipliers",
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
		"name": "collateralLendingRate",
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
		"name": "deltaBandWidth",
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
		"name": "deltaBorrowRates",
		"outputs": [
			{
				"internalType": "int256",
				"name": "sellLong",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "sellShort",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "buyLong",
				"type": "int256"
			},
			{
				"internalType": "int256",
				"name": "buyShort",
				"type": "int256"
			}
		],
		"stateMutability": "view",
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
		"name": "getCallSlippageGradientMultipliers",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getPutSlippageGradientMultipliers",
		"outputs": [
			{
				"internalType": "uint256[]",
				"name": "",
				"type": "uint256[]"
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
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "putSlippageGradientMultipliers",
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
				"internalType": "bool",
				"name": "isSell",
				"type": "bool"
			},
			{
				"internalType": "int256",
				"name": "netDhvExposure",
				"type": "int256"
			}
		],
		"name": "quoteOptionPrice",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "totalPremium",
				"type": "uint256"
			},
			{
				"internalType": "int256",
				"name": "totalDelta",
				"type": "int256"
			},
			{
				"internalType": "uint256",
				"name": "totalFees",
				"type": "uint256"
			}
		],
		"stateMutability": "view",
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
				"name": "_bidAskIVSpread",
				"type": "uint256"
			}
		],
		"name": "setBidAskIVSpread",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_collateralLendingRate",
				"type": "uint256"
			}
		],
		"name": "setCollateralLendingRate",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_deltaBandWidth",
				"type": "uint256"
			},
			{
				"internalType": "uint256[]",
				"name": "_callSlippageGradientMultipliers",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256[]",
				"name": "_putSlippageGradientMultipliers",
				"type": "uint256[]"
			}
		],
		"name": "setDeltaBandWidth",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "int256",
						"name": "sellLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "sellShort",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyLong",
						"type": "int256"
					},
					{
						"internalType": "int256",
						"name": "buyShort",
						"type": "int256"
					}
				],
				"internalType": "struct BeyondPricer.DeltaBorrowRates",
				"name": "_deltaBorrowRates",
				"type": "tuple"
			}
		],
		"name": "setDeltaBorrowRates",
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
				"internalType": "uint256",
				"name": "_slippageGradient",
				"type": "uint256"
			}
		],
		"name": "setSlippageGradient",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256[]",
				"name": "_callSlippageGradientMultipliers",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256[]",
				"name": "_putSlippageGradientMultipliers",
				"type": "uint256[]"
			}
		],
		"name": "setSlippageGradientMultipliers",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "slippageGradient",
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
] as const
