<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="https://images.emojiterra.com/mozilla/128px/1f52a.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Dynamic hedging</h3>

  <p align="center">
     Options delta neutrality as a crypto native uncorrelated asset class
    <br />
  </p>
</p>

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running follow these simple steps.

### Prerequisites

- npm

```sh
npm install npm@latest -g
```

### Installation

1. Clone the repo

```sh
git clone
```

2. Install NPM packages

```sh
npm install
```

or

```sh
yarn
```

3. Add environment variables

Create free API keys for alchemy and infura

a. Create /packages/contracts/.env with:

```sh
ALCHEMY_KEY=<your-alchemy-key>
```

b. Create /packages/front-end/.env with:

```sh
REACT_APP_INFURA_KEY=<your-infura-key>
```

4. Start a hardhat node as mainnet fork

```sh
cd packages/contracts
npm run mainnet-fork
```

From a new terminal window

5. Compile contracts

```sh
cd packages/contracts
npm run compile
```

6. Deploy contracts and update ABIs + address

```sh
cd packages/contracts
npm run deploy:localhost
```

7. Start the React app

```sh
cd packages/front-end
npm run start
```

<!-- USAGE EXAMPLES -->

## Usage

List of options

```sh
npx hardhat
```

Run tests

```sh
npx hardhat test
```

## Contract Architecture

![Rysk Architecture](./images/RyskArchitecture.png) ![Diagram C](./images/DiagramC.png)
![Diagram F](./images/DiagramF.png)

## Contract layout

```
contracts
├── hedging
│   ├── PerpHedgingReactor.sol
│   └── UniswapV3HedgingReactor.sol
├── interfaces
│   ├── AddressBookInterface.sol
│   ├── AggregatorV3Interface.sol
│   ├── GammaInterface.sol
│   ├── IERC20.sol
│   ├── IHedgingReactor.sol
│   ├── IMarginCalculator.sol
│   └── IOracle.sol
├── libraries
│   ├── BlackScholes.sol
│   ├── NormalDist.sol
│   ├── OptionsCompute.sol
│   ├── OpynInteractions.sol
│   ├── PRBMath.sol
│   ├── PRBMathSD59x18.sol
│   ├── PRBMathUD60x18.sol
│   ├── SafeTransferLib.sol
│   └── Types.sol
├── tokens
│   └── ERC20.sol
├── LiquidityPool.sol
├── OptionRegistry.sol
├── OptionsProtocol.sol
└── PriceFeed.sol
```
