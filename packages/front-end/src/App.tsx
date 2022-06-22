import { OnboardAPI } from "@web3-onboard/core";
import injectedModule from "@web3-onboard/injected-wallets";
import { init } from "@web3-onboard/react";
import walletConnectModule from "@web3-onboard/walletconnect";
import * as ethers from "ethers";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { Header } from "./components/Header";
import { AppPaths } from "./config/appPaths";
import { CHAINID, IDToNetwork } from "./config/constants";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { Dashboard } from "./pages/Dashboard";
import { OptionsTrading } from "./pages/OptionsTrading";
import { Vault } from "./pages/Vault";
import { GlobalContextProvider } from "./state/GlobalContext";
import { ETHNetwork } from "./types";
import { toHex } from "./utils";

// TODO(HC): Move infura key to env variable
const MAINNET_RPC_URL = `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`;
const ROPSTEN_RPC_URL = `https://ropsten.infura.io/v3/${process.env.REACT_APP_INFURA_URL}`;
const RINKEBY_RPC_URL = `https://rinkeby.infura.io/v3/${process.env.REACT_APP_INFURA_URL}`;
const ARBITRUM_RINKEBY_RPC_URL = `https://arbitrum-rinkeby.infura.io/v3/${process.env.REACT_APP_INFURA_URL}`;

const walletConnect = walletConnectModule();
const injectedWallets = injectedModule();

const onboard = init({
  wallets: [injectedWallets, walletConnect],
  chains: [
    {
      id: "0x1", // chain ID must be in hexadecimel
      token: "ETH", // main chain token
      namespace: "evm",
      label: "Ethereum Mainnet",
      rpcUrl: MAINNET_RPC_URL,
    },
    {
      id: "0x3",
      token: "tROP",
      namespace: "evm",
      label: "Ethereum Ropsten Testnet",
      rpcUrl: ROPSTEN_RPC_URL,
    },
    {
      id: "0x4",
      token: "rETH",
      namespace: "evm",
      label: "Ethereum Rinkeby Testnet",
      rpcUrl: RINKEBY_RPC_URL,
    },
    {
      id: "0x5",
      token: "rETH",
      namespace: "evm",
      label: "Arbitrum Rinkeby Testnet",
      rpcUrl: ARBITRUM_RINKEBY_RPC_URL,
    },
  ],
  appMetadata: {
    // TODO(HC): Update icon
    name: "Rysk",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg",
    description: "Uncorrelated returns",
    recommendedInjectedWallets: [
      { name: "Coinbase", url: "https://wallet.coinbase.com/" },
      { name: "MetaMask", url: "https://metamask.io" },
    ],
  },
});

type WalletContext = {
  connectWallet: (() => Promise<void>) | null;
  network: { name: ETHNetwork; id: CHAINID } | null;
  switchNetwork: (() => Promise<void>) | null;
  disconnect: (() => Promise<void>) | null;
  provider: ethers.ethers.providers.Web3Provider | null;
  account: string | null;
  error: any | null;
  chainId: string | null;
  isLoading: boolean | null;
};

const WalletContext = createContext<WalletContext>({
  connectWallet: null,
  switchNetwork: null,
  network: null,
  disconnect: null,
  provider: null,
  account: null,
  error: null,
  chainId: null,
  isLoading: null,
});

export const useWalletContext = () => useContext(WalletContext);

export const WALLETS_LOCAL_STORAGE_KEY = "connectedWallets";

function App() {
  const [web3Onboard, setWeb3Onboard] = useState<OnboardAPI | null>(null);
  const [walletUnsubscribe, setWalletUnsubscribe] = useState<
    (() => void) | null
  >(null);
  const [provider, setProvider] =
    useState<ethers.ethers.providers.Web3Provider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletContext["network"] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [getLocalStorage, setLocalStorage] = useLocalStorage();

  useEffect(() => {
    setWeb3Onboard(onboard);
  }, []);

  useEffect(() => {
    const walletsSub = web3Onboard?.state.select("wallets");
    if (walletsSub) {
      const { unsubscribe } = walletsSub.subscribe((wallets) => {
        const connectedWallets = wallets.map(({ label }) => label);
        setLocalStorage(WALLETS_LOCAL_STORAGE_KEY, connectedWallets);
      });
      if (walletUnsubscribe) {
        setWalletUnsubscribe(unsubscribe);
      }
    }
    return () => {
      walletUnsubscribe?.();
      setWalletUnsubscribe(null);
    };
  }, [web3Onboard, setLocalStorage, walletUnsubscribe]);

  const connectWallet = async (wallet?: string) => {
    try {
      const wallets = await onboard.connectWallet(
        wallet
          ? { autoSelect: { label: wallet, disableModals: true } }
          : undefined
      );
      setIsLoading(true);
      const { accounts, chains, provider } = wallets[0];
      const ethersProvider = new ethers.providers.Web3Provider(provider);
      setProvider(ethersProvider);
      const network = await ethersProvider.getNetwork();
      const networkName =
        network.chainId in IDToNetwork
          ? IDToNetwork[network.chainId as CHAINID]
          : null;
      if (networkName) {
        setNetwork({ id: network.chainId, name: networkName });
      }
      setAccount(accounts[0].address);
      setChainId(chains[0].id);
      setIsLoading(false);
    } catch (error) {
      setError(error);
    }
  };

  useEffect(() => {
    const wallets = getLocalStorage<string[]>(WALLETS_LOCAL_STORAGE_KEY);
    if (wallets && wallets.length > 0) {
      connectWallet(wallets[0]);
    }
  }, [getLocalStorage]);

  const switchNetwork = async () => {
    if (network) {
      await onboard.setChain({ chainId: toHex(network.id) });
    }
  };

  const disconnect = useCallback(async () => {
    const [primaryWallet] = await onboard.state.get().wallets;
    if (!primaryWallet) return;
    await onboard.disconnectWallet({ label: primaryWallet.label });
    refreshState();
  }, []);

  const refreshState = () => {
    setAccount("");
    setChainId("");
    setProvider(null);
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("chainChanged", disconnect);
      window.ethereum.on("accountsChanged", disconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("chainChanged", disconnect);
        window.ethereum.removeListener("accountsChanged", disconnect);
      }
    };
  }, [disconnect]);

  return (
    <WalletContext.Provider
      value={{
        connectWallet,
        network,
        switchNetwork,
        disconnect,
        provider,
        account,
        error,
        chainId,
        isLoading,
      }}
    >
      <GlobalContextProvider>
        <div className="App min-h-screen bg-bone font-dm-mono">
          <Header />
          <div className="pt-16 px-16">
            <div className="root-grid py-24">
              <Routes>
                <Route path={AppPaths.VAULT} element={<Vault />} />
                <Route path={AppPaths.TRADE} element={<OptionsTrading />} />
                <Route path={AppPaths.DASHBOARD} element={<Dashboard />} />
              </Routes>
            </div>
          </div>
        </div>
        <ToastContainer
          toastClassName="bg-bone rounded-none border-2 border-black font-dm-mono text-black max-w-xl w-fit"
          hideProgressBar
          position="bottom-center"
        />
      </GlobalContextProvider>
    </WalletContext.Provider>
  );
}

export default App;
