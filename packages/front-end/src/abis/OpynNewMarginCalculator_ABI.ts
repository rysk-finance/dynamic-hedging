export const OpynNewMarginCalculatorABI = [
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
  }
] as const;