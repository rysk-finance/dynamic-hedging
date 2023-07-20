import type { PropsWithChildren } from "react";
import type { Chain } from "wagmi";

import {
  connectorsForWallets,
  RainbowKitProvider,
  getDefaultWallets,
} from "@rainbow-me/rainbowkit";
import { ledgerWallet, trustWallet } from "@rainbow-me/rainbowkit/wallets";
import { configureChains, createClient, WagmiConfig } from "wagmi";
import { arbitrum, arbitrumGoerli } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";

import "@rainbow-me/rainbowkit/styles.css";

import { useUnstoppableDomain } from "src/hooks/useUnstoppableDomain";
import { ETHNetwork } from "src/types";
import Avatar from "./components/Avatar";
import Disclaimer from "./components/Disclaimer";
import CustomTheme from "./styles/Theme";

const defaultChains: [Chain] =
  process.env.REACT_APP_NETWORK === ETHNetwork.ARBITRUM_MAINNET
    ? [arbitrum]
    : [arbitrumGoerli];
const projectId = process.env.REACT_APP_WALLET_CONNECT_KEY || "";

const alchemy = process.env.REACT_APP_ALCHEMY_KEY
  ? [alchemyProvider({ apiKey: process.env.REACT_APP_ALCHEMY_KEY })]
  : [];

const infura = process.env.REACT_APP_INFURA_KEY
  ? [infuraProvider({ apiKey: process.env.REACT_APP_INFURA_KEY })]
  : [];

// Rudimentary load balancer.
const privateProviders = [...infura, ...alchemy].sort(
  () => Math.random() - Math.random()
);

const providers = [...privateProviders, publicProvider()];

const { chains, provider } = configureChains(defaultChains, providers);

const { wallets } = getDefaultWallets({
  appName: "Rysk Finance",
  projectId: projectId,
  chains,
});

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: "Available",
    wallets: [
      ledgerWallet({ chains, projectId }),
      trustWallet({ chains, projectId }),
    ],
  },
]);

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  logger: {
    warn: null,
  },
});

const WalletProvider = ({ children }: PropsWithChildren<unknown>) => {
  useUnstoppableDomain();

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
