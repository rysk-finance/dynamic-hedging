import { configureChains, createClient } from "wagmi";
import { arbitrum, arbitrumGoerli } from "wagmi/chains";
import { alchemyProvider } from "wagmi/providers/alchemy";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";

import { ETHNetwork } from "src/types";

const defaultChains =
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

const { provider } = configureChains(defaultChains, providers);

const wagmiClient = createClient({
  autoConnect: false,
  provider,
});

export { wagmiClient };
