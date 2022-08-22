import React from "react";
import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import { OnboardAPI } from "@web3-onboard/core";
import injectedModule from "@web3-onboard/injected-wallets";
import { init } from "@web3-onboard/react";
import walletConnectModule from "@web3-onboard/walletconnect";
import * as ethers from "ethers";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Route, Routes } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { Header } from "./components/Header";
import { AppPaths } from "./config/appPaths";
import { CHAINID, IDToNetwork, SUBGRAPH_URL } from "./config/constants";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { Dashboard } from "./pages/Dashboard";
import { OptionsTrading } from "./pages/OptionsTrading";
import { OTC } from "./pages/OTC";
import { Vault } from "./pages/Vault";
import { GlobalContextProvider } from "./state/GlobalContext";
import { ETHNetwork } from "./types";
import { toHex } from "./utils";
import {
  CONNECTED_FAVICON,
  DISCONNECTED_FAVICON,
  updateFavicon,
} from "./utils/updateFavicon";

export const RPC_URL_MAP: Record<CHAINID, string> = {
  [CHAINID.ETH_MAINNET]: `https://mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.ARBITRUM_MAINNET]: `https://arbitrum-mainnet.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.ARBITRUM_RINKEBY]: `https://arbitrum-rinkeby.infura.io/v3/${process.env.REACT_APP_INFURA_KEY}`,
  [CHAINID.LOCALHOST]: "",
};

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
      rpcUrl: RPC_URL_MAP[CHAINID.ETH_MAINNET],
    },
    {
      id: "0x2",
      token: "ARETH",
      namespace: "evm",
      label: "Arbitrum Rinkeby Testnet",
      rpcUrl: RPC_URL_MAP[CHAINID.ARBITRUM_RINKEBY],
    },
    {
      id: "0x3",
      token: "ETH",
      namespace: "evm",
      label: "Arbitrum Mainnet",
      rpcUrl: RPC_URL_MAP[CHAINID.ARBITRUM_MAINNET],
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
  signer: ethers.ethers.providers.JsonRpcSigner | null;
  rpcURL: string | null;
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
  signer: null,
  rpcURL: null,
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
  const [signer, setSigner] =
    useState<ethers.ethers.providers.JsonRpcSigner | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [network, setNetwork] = useState<WalletContext["network"] | null>(null);
  //
  const [rpcURL, setRPCURL] = useState<string>(
    process.env.REACT_APP_ENV === "mainnet"
      ? RPC_URL_MAP[CHAINID.ARBITRUM_MAINNET]
      : RPC_URL_MAP[CHAINID.ARBITRUM_RINKEBY]
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Initialising to a client with undefined URL, rather than just null, as ApolloProvider
  // expects client to always be non-null. We overwrite with a new client with a defined
  // uri in a useEffect below.
  const [apolloClient, setApolloClient] = useState(
    new ApolloClient({
      uri: undefined,
      cache: new InMemoryCache(),
    })
  );

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

  const connectWallet = useCallback(async (wallet?: string) => {
    try {
      const wallets = await onboard.connectWallet(
        wallet
          ? { autoSelect: { label: wallet, disableModals: true } }
          : undefined
      );
      setIsLoading(true);
      const { accounts, chains, provider } = wallets[0];
      const ethersProvider = new ethers.providers.Web3Provider(provider);
      const ethersSigner = ethersProvider.getSigner();
      const initialNetwork = await ethersProvider.getNetwork();
      const isCorrectChain =
        initialNetwork.chainId ===
        (process.env.REACT_APP_ENV === "production"
          ? CHAINID.ARBITRUM_MAINNET
          : CHAINID.ARBITRUM_RINKEBY);
      if (!isCorrectChain) {
        if (process.env.REACT_APP_ENV === "production") {
          await addArbitrum();
        } else {
          await addArbitrumTestnet();
        }
      }

      const networkId =
        process.env.REACT_APP_ENV === "production"
          ? CHAINID.ARBITRUM_MAINNET
          : process.env.REACT_APP_ENV === "testnet"
          ? CHAINID.ARBITRUM_RINKEBY
          : null;
      if (networkId) {
        const networkName =
          networkId in IDToNetwork ? IDToNetwork[networkId as CHAINID] : null;
        if (networkName) {
          setNetwork({ id: networkId, name: networkName });
        }
      }
      setSigner(ethersSigner);
      setAccount(accounts[0].address);
      const networkRPCURL = RPC_URL_MAP[networkId as CHAINID];
      setRPCURL(networkRPCURL);
      setChainId(String(networkId));
      setIsLoading(false);
      updateFavicon(CONNECTED_FAVICON);
    } catch (error) {
      setIsLoading(false);
      setError(error);
    }
  }, []);

  useEffect(() => {
    const wallets = getLocalStorage<string[]>(WALLETS_LOCAL_STORAGE_KEY);
    if (wallets && wallets.length > 0) {
      connectWallet(wallets[0]);
    }
  }, [getLocalStorage, connectWallet]);

  const addArbitrum = async () => {
    if (window.ethereum) {
      try {
        const a = await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0xa4b1", // A 0x-prefixed hexadecimal string
              chainName: "Arbitrum One",
              nativeCurrency: {
                name: "Ethereum",
                symbol: "arETH",
                decimals: 18,
              },
              rpcUrls: ["https://arb1.arbitrum.io/rpc"],
              blockExplorerUrls: ["https://arbiscan.io/"],
            },
          ],
        });
        debugger;
      } catch {
        toast("❌ RYSK only works on Arbitrum");
      }
    }
  };

  const addArbitrumTestnet = async () => {
    if (window.ethereum) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x66EEB", // A 0x-prefixed hexadecimal string
            chainName: "Arbitrum Testnet",
            nativeCurrency: {
              name: "Ethereum",
              symbol: "arETH",
              decimals: 18,
            },
            rpcUrls: ["https://rinkeby.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://rinkeby-explorer.arbitrum.io/"],
          },
        ],
      });
    }
  };

  const switchNetwork = async () => {
    if (network) {
      await onboard.setChain({ chainId: toHex(network.id) });
    }
  };

  const disconnect = useCallback(async () => {
    const [primaryWallet] = await onboard.state.get().wallets;
    if (!primaryWallet) return;
    await onboard.disconnectWallet({ label: primaryWallet.label });
    updateFavicon(DISCONNECTED_FAVICON);
    refreshState();
  }, []);

  const refreshState = () => {
    setAccount("");
    setChainId("");
    setSigner(null);
    setNetwork(null);
  };

  const handleChainChange = useCallback(
    async (chainIdHex: string) => {
      const chainId = parseInt(chainIdHex);
      const correctChainID =
        process.env.REACT_APP_ENV === "production"
          ? CHAINID.ARBITRUM_MAINNET
          : CHAINID.ARBITRUM_RINKEBY;
      if (chainId !== correctChainID) {
        disconnect();
      }
    },
    [disconnect]
  );

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("chainChanged", handleChainChange);
      window.ethereum.on("accountsChanged", disconnect);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("chainChanged", handleChainChange);
        window.ethereum.removeListener("accountsChanged", disconnect);
      }
    };
  }, [disconnect, handleChainChange]);

  useEffect(() => {
    const SUBGRAPH_URI =
      network?.id !== undefined ? SUBGRAPH_URL[network?.id] : "";

    const client = new ApolloClient({
      uri: SUBGRAPH_URI,
      cache: new InMemoryCache(),
    });

    setApolloClient(client);
  }, [network?.id]);

  return (
    <WalletContext.Provider
      value={{
        connectWallet,
        network,
        switchNetwork,
        disconnect,
        signer,
        rpcURL,
        account,
        error,
        chainId,
        isLoading,
      }}
    >
      <GlobalContextProvider>
        <ApolloProvider client={apolloClient}>
          <div className="App min-h-screen bg-bone font-dm-mono">
            <Header />
            <div className="pt-16 px-16">
              <div className="root-grid py-24">
                <Routes>
                  <Route path={AppPaths.VAULT} element={<Vault />} />
                  <Route path={AppPaths.TRADE} element={<OptionsTrading />} />
                  <Route path={AppPaths.DASHBOARD} element={<Dashboard />} />
                  <Route path={AppPaths.OTC} element={<OTC />} />
                </Routes>
              </div>
            </div>
          </div>
          <ToastContainer
            toastClassName="bg-bone rounded-none border-2 border-black font-dm-mono text-black max-w-xl w-fit"
            hideProgressBar
            position="bottom-center"
          />
        </ApolloProvider>
      </GlobalContextProvider>
    </WalletContext.Provider>
  );
}

export default App;
