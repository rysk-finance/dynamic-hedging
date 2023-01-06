import React from "react";
import {
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
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
import { Route, Routes, useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { Header } from "./components/Header";
import { AppPaths } from "./config/appPaths";
import {
  CHAINID,
  DEFAULT_POLLING_INTERVAL,
  IDToNetwork,
  OPYN_SUBGRAPH_URL,
  RPC_URL_MAP,
  SUBGRAPH_URL,
} from "./config/constants";
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
import { Footer } from "./components/Footer";
import * as Fathom from "fathom-client";
import { LegalDisclaimer } from "./components/LegalDisclaimer";
import { MobileWarning } from "./components/MobileWarning";

const walletConnect = walletConnectModule();
const injectedWallets = injectedModule();

const onboard = init({
  wallets: [injectedWallets, walletConnect],
  chains: [
    {
      id: "0x66eed",
      token: "AGOR",
      namespace: "evm",
      label: "Arbitrum Goerli",
      rpcUrl: RPC_URL_MAP[CHAINID.ARBITRUM_GOERLI],
    },
    {
      id: "0xa4b1",
      token: "ETH",
      namespace: "evm",
      label: "Arbitrum Mainnet",
      rpcUrl: RPC_URL_MAP[CHAINID.ARBITRUM_MAINNET],
    },
  ],
  appMetadata: {
    name: "Rysk",
    icon: "/logo.png",
    logo: "/logo.png",
    description: "Uncorrelated returns",
    recommendedInjectedWallets: [
      { name: "Coinbase", url: "https://wallet.coinbase.com/" },
      { name: "MetaMask", url: "https://metamask.io" },
    ],
  },
});

// Stores information relating to browser <-> wallet connect.
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
    process.env.REACT_APP_ENV === "production"
      ? RPC_URL_MAP[CHAINID.ARBITRUM_MAINNET]
      : RPC_URL_MAP[CHAINID.ARBITRUM_GOERLI]
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
      ethersProvider.pollingInterval = DEFAULT_POLLING_INTERVAL;
      const initialNetwork = await ethersProvider.getNetwork();
      const isCorrectChain =
        initialNetwork.chainId ===
        (process.env.REACT_APP_ENV === "production"
          ? CHAINID.ARBITRUM_MAINNET
          : CHAINID.ARBITRUM_GOERLI);
      if (!isCorrectChain) {
        if (process.env.REACT_APP_ENV === "production") {
          await addArbitrum();
          connectWallet();
          return;
        } else {
          await addArbitrumTestnet();
          connectWallet();
          return;
        }
      }

      const networkId =
        process.env.REACT_APP_ENV === "production"
          ? CHAINID.ARBITRUM_MAINNET
          : process.env.REACT_APP_ENV === "testnet"
          ? CHAINID.ARBITRUM_GOERLI
          : null;
      if (networkId) {
        const networkName =
          networkId in IDToNetwork ? IDToNetwork[networkId as CHAINID] : null;
        if (networkName) {
          setNetwork({ id: networkId, name: networkName });
        }
      }
      const ethersSigner = ethersProvider.getSigner();
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
        await window.ethereum.request({
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
            chainId: "0x66EED", // A 0x-prefixed hexadecimal string
            chainName: "Arbitrum Görli",
            nativeCurrency: {
              name: "Ethereum",
              symbol: "AGOR",
              decimals: 18,
            },
            rpcUrls: ["https://goerli-rollup.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://goerli.arbiscan.io/"],
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
          : CHAINID.ARBITRUM_GOERLI;
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
      network?.id !== undefined
        ? SUBGRAPH_URL[network?.id]
        : process.env.REACT_APP_ENV === "production"
        ? SUBGRAPH_URL[CHAINID.ARBITRUM_MAINNET]
        : SUBGRAPH_URL[CHAINID.ARBITRUM_GOERLI];

    const OPYN_SUBGRAPH_URI =
      network?.id !== undefined
        ? OPYN_SUBGRAPH_URL[network?.id]
        : process.env.REACT_APP_ENV === "production"
        ? OPYN_SUBGRAPH_URL[CHAINID.ARBITRUM_MAINNET]
        : OPYN_SUBGRAPH_URL[CHAINID.ARBITRUM_GOERLI];

    const ryskSubgraph = new HttpLink({
      uri: SUBGRAPH_URI,
    });

    const opynSubgraph = new HttpLink({
      uri: OPYN_SUBGRAPH_URI,
    });

    const client = new ApolloClient({
      link: ApolloLink.split(
        (operation) => operation.getContext().clientName === "opyn",
        opynSubgraph, // <= apollo will send to this if clientName is "opyn"
        ryskSubgraph // <= otherwise will send to this
      ),
      cache: new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              writeOptionsActions: {
                keyArgs: false,
                merge(existing = [], incoming) {
                  return [...existing, ...incoming];
                },
              },
              buybackOptionActions: {
                keyArgs: false,
                merge(existing = [], incoming) {
                  return [...existing, ...incoming];
                },
              },
              rebalanceDeltaActions: {
                keyArgs: false,
                merge(existing = [], incoming) {
                  return [...existing, ...incoming];
                },
              },
            },
          },
        },
      }),
    });

    setApolloClient(client);
  }, [network?.id]);

  useEffect(() => {
    // Initialize Fathom when the app loads
    // Example: yourdomain.com
    //  - Do not include https://
    //  - This must be an exact match of your domain.
    //  - If you're using www. for your domain, make sure you include that here.
    Fathom.load("SMDEXJZR", { excludedDomains: ["localhost:3000"] });
  }, []);

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
          <div className="App bg-bone font-dm-mono flex flex-col min-h-screen">
            <LegalDisclaimer />
            <MobileWarning />
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
            <Footer />
          </div>
          <ToastContainer
            toastClassName="bg-bone rounded-none border-2 border-black font-dm-mono text-black max-w-xl w-fit"
            hideProgressBar
            position="bottom-center"
            autoClose={5000}
          />
        </ApolloProvider>
      </GlobalContextProvider>
    </WalletContext.Provider>
  );
}

export default App;
