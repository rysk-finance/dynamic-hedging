export const DHVLensMK1ABI = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_protocol",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_catalogue",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_pricer",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_collateralAsset",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_underlyingAsset",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_strikeAsset",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "_exchange",
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
		"name": "catalogue",
		"outputs": [
			{
				"internalType": "contract OptionCatalogue",
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
		"inputs": [],
		"name": "computeOptionsValues",
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
		"inputs": [],
		"name": "exchange",
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
		"name": "getCurrentPricePerShare",
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
		"inputs": [],
		"name": "getOptionChain",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint64[]",
						"name": "expirations",
						"type": "uint64[]"
					},
					{
						"components": [
							{
								"internalType": "uint64",
								"name": "expiration",
								"type": "uint64"
							},
							{
								"internalType": "uint128[]",
								"name": "callStrikes",
								"type": "uint128[]"
							},
							{
								"components": [
									{
										"internalType": "uint128",
										"name": "strike",
										"type": "uint128"
									},
									{
										"components": [
											{
												"internalType": "uint256",
												"name": "iv",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "quote",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "fee",
												"type": "uint256"
											},
											{
												"internalType": "bool",
												"name": "disabled",
												"type": "bool"
											},
											{
												"internalType": "bool",
												"name": "premiumTooSmall",
												"type": "bool"
											}
										],
										"internalType": "struct DHVLensMK1.TradingSpec",
										"name": "sell",
										"type": "tuple"
									},
									{
										"components": [
											{
												"internalType": "uint256",
												"name": "iv",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "quote",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "fee",
												"type": "uint256"
											},
											{
												"internalType": "bool",
												"name": "disabled",
												"type": "bool"
											},
											{
												"internalType": "bool",
												"name": "premiumTooSmall",
												"type": "bool"
											}
										],
										"internalType": "struct DHVLensMK1.TradingSpec",
										"name": "buy",
										"type": "tuple"
									},
									{
										"internalType": "int256",
										"name": "delta",
										"type": "int256"
									},
									{
										"internalType": "int256",
										"name": "exposure",
										"type": "int256"
									},
									{
										"components": [
											{
												"internalType": "address",
												"name": "seriesAddress",
												"type": "address"
											},
											{
												"internalType": "uint256",
												"name": "optionExchangeBalance",
												"type": "uint256"
											}
										],
										"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
										"name": "usdCollatseriesExchangeBalance",
										"type": "tuple"
									},
									{
										"components": [
											{
												"internalType": "address",
												"name": "seriesAddress",
												"type": "address"
											},
											{
												"internalType": "uint256",
												"name": "optionExchangeBalance",
												"type": "uint256"
											}
										],
										"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
										"name": "wethCollatseriesExchangeBalance",
										"type": "tuple"
									}
								],
								"internalType": "struct DHVLensMK1.OptionStrikeDrill[]",
								"name": "callOptionDrill",
								"type": "tuple[]"
							},
							{
								"internalType": "uint128[]",
								"name": "putStrikes",
								"type": "uint128[]"
							},
							{
								"components": [
									{
										"internalType": "uint128",
										"name": "strike",
										"type": "uint128"
									},
									{
										"components": [
											{
												"internalType": "uint256",
												"name": "iv",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "quote",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "fee",
												"type": "uint256"
											},
											{
												"internalType": "bool",
												"name": "disabled",
												"type": "bool"
											},
											{
												"internalType": "bool",
												"name": "premiumTooSmall",
												"type": "bool"
											}
										],
										"internalType": "struct DHVLensMK1.TradingSpec",
										"name": "sell",
										"type": "tuple"
									},
									{
										"components": [
											{
												"internalType": "uint256",
												"name": "iv",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "quote",
												"type": "uint256"
											},
											{
												"internalType": "uint256",
												"name": "fee",
												"type": "uint256"
											},
											{
												"internalType": "bool",
												"name": "disabled",
												"type": "bool"
											},
											{
												"internalType": "bool",
												"name": "premiumTooSmall",
												"type": "bool"
											}
										],
										"internalType": "struct DHVLensMK1.TradingSpec",
										"name": "buy",
										"type": "tuple"
									},
									{
										"internalType": "int256",
										"name": "delta",
										"type": "int256"
									},
									{
										"internalType": "int256",
										"name": "exposure",
										"type": "int256"
									},
									{
										"components": [
											{
												"internalType": "address",
												"name": "seriesAddress",
												"type": "address"
											},
											{
												"internalType": "uint256",
												"name": "optionExchangeBalance",
												"type": "uint256"
											}
										],
										"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
										"name": "usdCollatseriesExchangeBalance",
										"type": "tuple"
									},
									{
										"components": [
											{
												"internalType": "address",
												"name": "seriesAddress",
												"type": "address"
											},
											{
												"internalType": "uint256",
												"name": "optionExchangeBalance",
												"type": "uint256"
											}
										],
										"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
										"name": "wethCollatseriesExchangeBalance",
										"type": "tuple"
									}
								],
								"internalType": "struct DHVLensMK1.OptionStrikeDrill[]",
								"name": "putOptionDrill",
								"type": "tuple[]"
							},
							{
								"internalType": "uint256",
								"name": "underlyingPrice",
								"type": "uint256"
							}
						],
						"internalType": "struct DHVLensMK1.OptionExpirationDrill[]",
						"name": "optionExpirationDrills",
						"type": "tuple[]"
					}
				],
				"internalType": "struct DHVLensMK1.OptionChain",
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
				"internalType": "uint64",
				"name": "expiration",
				"type": "uint64"
			}
		],
		"name": "getOptionExpirationDrill",
		"outputs": [
			{
				"components": [
					{
						"internalType": "uint64",
						"name": "expiration",
						"type": "uint64"
					},
					{
						"internalType": "uint128[]",
						"name": "callStrikes",
						"type": "uint128[]"
					},
					{
						"components": [
							{
								"internalType": "uint128",
								"name": "strike",
								"type": "uint128"
							},
							{
								"components": [
									{
										"internalType": "uint256",
										"name": "iv",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "quote",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "fee",
										"type": "uint256"
									},
									{
										"internalType": "bool",
										"name": "disabled",
										"type": "bool"
									},
									{
										"internalType": "bool",
										"name": "premiumTooSmall",
										"type": "bool"
									}
								],
								"internalType": "struct DHVLensMK1.TradingSpec",
								"name": "sell",
								"type": "tuple"
							},
							{
								"components": [
									{
										"internalType": "uint256",
										"name": "iv",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "quote",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "fee",
										"type": "uint256"
									},
									{
										"internalType": "bool",
										"name": "disabled",
										"type": "bool"
									},
									{
										"internalType": "bool",
										"name": "premiumTooSmall",
										"type": "bool"
									}
								],
								"internalType": "struct DHVLensMK1.TradingSpec",
								"name": "buy",
								"type": "tuple"
							},
							{
								"internalType": "int256",
								"name": "delta",
								"type": "int256"
							},
							{
								"internalType": "int256",
								"name": "exposure",
								"type": "int256"
							},
							{
								"components": [
									{
										"internalType": "address",
										"name": "seriesAddress",
										"type": "address"
									},
									{
										"internalType": "uint256",
										"name": "optionExchangeBalance",
										"type": "uint256"
									}
								],
								"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
								"name": "usdCollatseriesExchangeBalance",
								"type": "tuple"
							},
							{
								"components": [
									{
										"internalType": "address",
										"name": "seriesAddress",
										"type": "address"
									},
									{
										"internalType": "uint256",
										"name": "optionExchangeBalance",
										"type": "uint256"
									}
								],
								"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
								"name": "wethCollatseriesExchangeBalance",
								"type": "tuple"
							}
						],
						"internalType": "struct DHVLensMK1.OptionStrikeDrill[]",
						"name": "callOptionDrill",
						"type": "tuple[]"
					},
					{
						"internalType": "uint128[]",
						"name": "putStrikes",
						"type": "uint128[]"
					},
					{
						"components": [
							{
								"internalType": "uint128",
								"name": "strike",
								"type": "uint128"
							},
							{
								"components": [
									{
										"internalType": "uint256",
										"name": "iv",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "quote",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "fee",
										"type": "uint256"
									},
									{
										"internalType": "bool",
										"name": "disabled",
										"type": "bool"
									},
									{
										"internalType": "bool",
										"name": "premiumTooSmall",
										"type": "bool"
									}
								],
								"internalType": "struct DHVLensMK1.TradingSpec",
								"name": "sell",
								"type": "tuple"
							},
							{
								"components": [
									{
										"internalType": "uint256",
										"name": "iv",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "quote",
										"type": "uint256"
									},
									{
										"internalType": "uint256",
										"name": "fee",
										"type": "uint256"
									},
									{
										"internalType": "bool",
										"name": "disabled",
										"type": "bool"
									},
									{
										"internalType": "bool",
										"name": "premiumTooSmall",
										"type": "bool"
									}
								],
								"internalType": "struct DHVLensMK1.TradingSpec",
								"name": "buy",
								"type": "tuple"
							},
							{
								"internalType": "int256",
								"name": "delta",
								"type": "int256"
							},
							{
								"internalType": "int256",
								"name": "exposure",
								"type": "int256"
							},
							{
								"components": [
									{
										"internalType": "address",
										"name": "seriesAddress",
										"type": "address"
									},
									{
										"internalType": "uint256",
										"name": "optionExchangeBalance",
										"type": "uint256"
									}
								],
								"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
								"name": "usdCollatseriesExchangeBalance",
								"type": "tuple"
							},
							{
								"components": [
									{
										"internalType": "address",
										"name": "seriesAddress",
										"type": "address"
									},
									{
										"internalType": "uint256",
										"name": "optionExchangeBalance",
										"type": "uint256"
									}
								],
								"internalType": "struct DHVLensMK1.SeriesExchangeBalance",
								"name": "wethCollatseriesExchangeBalance",
								"type": "tuple"
							}
						],
						"internalType": "struct DHVLensMK1.OptionStrikeDrill[]",
						"name": "putOptionDrill",
						"type": "tuple[]"
					},
					{
						"internalType": "uint256",
						"name": "underlyingPrice",
						"type": "uint256"
					}
				],
				"internalType": "struct DHVLensMK1.OptionExpirationDrill",
				"name": "",
				"type": "tuple"
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
		"name": "pricer",
		"outputs": [
			{
				"internalType": "contract BeyondPricer",
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
] as const;
