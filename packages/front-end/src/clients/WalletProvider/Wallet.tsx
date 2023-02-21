import type { PropsWithChildren } from "react";
import type { Chain } from "wagmi";

import {
  connectorsForWallets,
  RainbowKitProvider,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  trustWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import { arbitrum, arbitrumGoerli } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";

import "@rainbow-me/rainbowkit/styles.css";

import { ETHNetwork } from "src/types";
import Avatar from "./components/Avatar";
import Disclaimer from "./components/Disclaimer";
import CustomTheme from "./styles/Theme";

const defaultChains: [Chain] =
  process.env.REACT_APP_NETWORK === ETHNetwork.ARBITRUM_MAINNET
    ? [arbitrum]
    : [arbitrumGoerli];

const alchemy = process.env.REACT_APP_ALCHEMY_KEY
  ? [alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_KEY })]
  : [];

const infura = process.env.REACT_APP_INFURA_KEY
  ? [infuraProvider({ apiKey: process.env.REACT_APP_INFURA_KEY })]
  : [];

const providers = [...alchemy, ...infura, publicProvider()];

const { chains, provider } = configureChains(defaultChains, providers, {
  pollingInterval: 10000,
});

const connectors = connectorsForWallets([
  {
    groupName: "Recommended",
    wallets: [
      injectedWallet({ chains }),
      metaMaskWallet({ chains }),
      walletConnectWallet({ chains }),
    ],
  },
  {
    groupName: "Available",
    wallets: [
      coinbaseWallet({ appName: "Rysk", chains }),
      ledgerWallet({ chains }),
      trustWallet({ chains }),
    ],
  },
]);

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
});

const WalletProvider = ({ children }: PropsWithChildren<unknown>) => {
  return (
    <WagmiConfig client={wagmiClient}>
      <RainbowKitProvider
        appInfo={{
          appName: "Rysk",
          disclaimer: Disclaimer,
        }}
        avatar={Avatar}
        chains={chains}
        showRecentTransactions={true}
        theme={CustomTheme}
      >
        <div>{children}</div>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default WalletProvider;
