import { OnboardAPI } from "@web3-onboard/core";
import injectedModule from "@web3-onboard/injected-wallets";
import { init } from "@web3-onboard/react";
import walletConnectModule from "@web3-onboard/walletconnect";
import { EthersAppContext } from "eth-hooks/context";
import * as ethers from "ethers";
import React, { createContext, useContext, useEffect, useState } from "react";
import "./App.css";
import { Header } from "./components/Header";
import { toHex } from "./utils";
import { Routes, Route } from "react-router-dom";
import { Vault } from "./pages/Vault";
import { OptionsTrading } from "./pages/OptionsTrading";
import { Dashboard } from "./pages/Dashboard";

// TODO(HC): Move infura key to env variable
const MAINNET_RPC_URL = `https://mainnet.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;
const ROPSTEN_RPC_URL = `https://ropsten.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;
const RINKEBY_RPC_URL = `https://rinkeby.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;

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
  ],
  appMetadata: {
    name: "My App",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg",
    description: "My app using Onboard",
    recommendedInjectedWallets: [
      { name: "Coinbase", url: "https://wallet.coinbase.com/" },
      { name: "MetaMask", url: "https://metamask.io" },
    ],
  },
});

type WalletContext = {
  connectWallet: (() => Promise<void>) | null;
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
  disconnect: null,
  provider: null,
  account: null,
  error: null,
  chainId: null,
  isLoading: null,
});

export const useWalletContext = () => useContext(WalletContext);

function App() {
  const [web3Onboard, setWeb3Onboard] = useState<OnboardAPI | null>(null);
  const [provider, setProvider] =
    useState<ethers.ethers.providers.Web3Provider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [network, setNetwork] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setWeb3Onboard(onboard);
  }, []);

  const connectWallet = async () => {
    try {
      const wallets = await onboard.connectWallet();
      setIsLoading(true);
      const { accounts, chains, provider } = wallets[0];
      const ethersProvider = new ethers.providers.Web3Provider(provider);
      setProvider(ethersProvider);
      setAccount(accounts[0].address);
      setChainId(chains[0].id);
      setIsLoading(false);
    } catch (error) {
      setError(error);
    }
  };

  const switchNetwork = async () => {
    if (network) {
      await onboard.setChain({ chainId: toHex(network) });
    }
  };

  const disconnect = async () => {
    const [primaryWallet] = await onboard.state.get().wallets;
    if (!primaryWallet) return;
    await onboard.disconnectWallet({ label: primaryWallet.label });
    refreshState();
  };

  const refreshState = () => {
    setAccount("");
    setChainId("");
    setProvider(null);
  };

  return (
    <WalletContext.Provider
      value={{
        connectWallet,
        switchNetwork,
        disconnect,
        provider,
        account,
        error,
        chainId,
        isLoading,
      }}
    >
      <EthersAppContext>
        <div className="App min-h-screen bg-bone font-dm-mono">
          <Header />
          <div className="pt-16 px-16">
            <div className="root-grid py-24">
              <Routes>
                <Route path="/" element={<Vault />} />
                <Route path="options" element={<OptionsTrading />} />
                <Route path="dashboard" element={<Dashboard />} />
              </Routes>
            </div>
          </div>
        </div>
      </EthersAppContext>
    </WalletContext.Provider>
  );
}

export default App;
