export const NewMarginCalculatorABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_oracle",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_addressBook",
				"type": "address"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "collateral",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "dust",
				"type": "uint256"
			}
		],
		"name": "CollateralDustUpdated",
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
				"indexed": false,
				"internalType": "uint256",
				"name": "fee",
				"type": "uint256"
			}
		],
		"name": "FeeUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "liquidationMultiplier",
				"type": "uint256"
			}
		],
		"name": "LiquidationMultiplierUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "productHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timeToExpiry",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "value",
				"type": "uint256"
			}
		],
		"name": "MaxPriceAdded",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "productHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timeToExpiry",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oldValue",
				"type": "uint256"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "newValue",
				"type": "uint256"
			}
		],
		"name": "MaxPriceUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "oracleDeviation",
				"type": "uint256"
			}
		],
		"name": "OracleDeviationUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "product",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "spotShock",
				"type": "uint256"
			}
		],
		"name": "SpotShockUpdated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "productHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "timeToExpiry",
				"type": "uint256"
			}
		],
		"name": "TimeToExpiryAdded",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "AUCTION_TIME",
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
		"name": "fee",
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
		"inputs": [
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			}
		],
		"name": "getCollateralDust",
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
						"internalType": "address[]",
						"name": "shortOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "longOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "collateralAssets",
						"type": "address[]"
					},
					{
						"internalType": "uint256[]",
						"name": "shortAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "longAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "collateralAmounts",
						"type": "uint256[]"
					}
				],
				"internalType": "struct MarginVault.Vault",
				"name": "_vault",
				"type": "tuple"
			},
			{
				"internalType": "uint256",
				"name": "_vaultType",
				"type": "uint256"
			}
		],
		"name": "getExcessCollateral",
		"outputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			},
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
				"name": "_otoken",
				"type": "address"
			}
		],
		"name": "getExpiredPayoutRate",
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
		"name": "getFeeInformation",
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
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{
						"internalType": "address[]",
						"name": "shortOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "longOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "collateralAssets",
						"type": "address[]"
					},
					{
						"internalType": "uint256[]",
						"name": "shortAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "longAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "collateralAmounts",
						"type": "uint256[]"
					}
				],
				"internalType": "struct MarginVault.Vault",
				"name": "_vault",
				"type": "tuple"
			},
			{
				"internalType": "uint256",
				"name": "_vaultType",
				"type": "uint256"
			}
		],
		"name": "getMarginRequired",
		"outputs": [
			{
				"components": [
					{
						"internalType": "int256",
						"name": "value",
						"type": "int256"
					}
				],
				"internalType": "struct FixedPointInt256.FixedPointInt",
				"name": "",
				"type": "tuple"
			},
			{
				"components": [
					{
						"internalType": "int256",
						"name": "value",
						"type": "int256"
					}
				],
				"internalType": "struct FixedPointInt256.FixedPointInt",
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
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "_timeToExpiry",
				"type": "uint256"
			}
		],
		"name": "getMaxPrice",
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
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_shortAmount",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_strikePrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_underlyingPrice",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_shortExpiryTimestamp",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_collateralDecimals",
				"type": "uint256"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			}
		],
		"name": "getNakedMarginRequired",
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
		"name": "getOracleDeviation",
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
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			}
		],
		"name": "getSpotShock",
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
				"name": "_underlying",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			}
		],
		"name": "getTimesToExpiry",
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
		"inputs": [
			{
				"components": [
					{
						"internalType": "address[]",
						"name": "shortOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "longOtokens",
						"type": "address[]"
					},
					{
						"internalType": "address[]",
						"name": "collateralAssets",
						"type": "address[]"
					},
					{
						"internalType": "uint256[]",
						"name": "shortAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "longAmounts",
						"type": "uint256[]"
					},
					{
						"internalType": "uint256[]",
						"name": "collateralAmounts",
						"type": "uint256[]"
					}
				],
				"internalType": "struct MarginVault.Vault",
				"name": "_vault",
				"type": "tuple"
			},
			{
				"internalType": "uint256",
				"name": "_vaultType",
				"type": "uint256"
			}
		],
		"name": "isLiquidatable",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			},
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
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "liquidationMultiplier",
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
		"name": "oracle",
		"outputs": [
			{
				"internalType": "contract OracleInterface",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
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
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "_dust",
				"type": "uint256"
			}
		],
		"name": "setCollateralDust",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_fee",
				"type": "uint256"
			}
		],
		"name": "setFee",
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
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_liquidationMultiplier",
				"type": "uint256"
			}
		],
		"name": "setLiquidationMultiplier",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "_deviation",
				"type": "uint256"
			}
		],
		"name": "setOracleDeviation",
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
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "_shockValue",
				"type": "uint256"
			}
		],
		"name": "setSpotShock",
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
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			},
			{
				"internalType": "uint256[]",
				"name": "_timesToExpiry",
				"type": "uint256[]"
			},
			{
				"internalType": "uint256[]",
				"name": "_values",
				"type": "uint256[]"
			}
		],
		"name": "setUpperBoundValues",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
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
				"name": "_strike",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateral",
				"type": "address"
			},
			{
				"internalType": "bool",
				"name": "_isPut",
				"type": "bool"
			},
			{
				"internalType": "uint256",
				"name": "_timeToExpiry",
				"type": "uint256"
			},
			{
				"internalType": "uint256",
				"name": "_value",
				"type": "uint256"
			}
		],
		"name": "updateUpperBoundValue",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
] as const;
