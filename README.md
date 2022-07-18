<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="./packages/front-end/public/logo.png" alt="Logo" width="auto" height="200">
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

## Testing Contracts

Complete steps 1 to 3 from above:

Compile all files

```sh
npm run compile
```

Run all tests

```sh
npx hardhat test
```

To run a specific test suite, e.g. LiquidityPool.ts

```sh
npx hardhat test test/LiquidityPool.ts
```

Run test coverage

```sh
npm run test-coverage
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
│   ├── IAuthority.sol
│   ├── AggregatorV3Interface.sol
│   ├── GammaInterface.sol
│   ├── IERC20.sol
│   ├── IOptionRegistry.sol
│   ├── ILiquidityPool.sol
│   ├── IHedgingReactor.sol
│   ├── IMarginCalculator.sol
│   └── IOracle.sol
├── libraries
│   ├── BlackScholes.sol
│   ├── CustomErrors.sol
│   ├── NormalDist.sol
│   ├── OptionsCompute.sol
│   ├── OpynInteractions.sol
│   ├── AccessControl.sol
│   ├── SafeTransferLib.sol
│   └── Types.sol
├── tokens
│   └── ERC20.sol
├── Authority.sol
├── LiquidityPool.sol
├── OptionRegistry.sol
├── OptionHandler.sol
├── Protocol.sol
├── PortfolioValuesFeed.sol
├── VolatilityFeed.sol
└── PriceFeed.sol
```
