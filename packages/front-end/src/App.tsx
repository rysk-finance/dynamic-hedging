import Onboard, { EIP1193Provider } from "@web3-onboard/core";
import { EthersAppContext } from "eth-hooks/context";
import React, { useState } from "react";
import "./App.css";
import { Header } from "./components/Header";
import { toHex } from "./utils";
import walletConnectModule from "@web3-onboard/walletconnect";
import injectedModule from "@web3-onboard/injected-wallets";

const MAINNET_RPC_URL = `https://mainnet.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;
const ROPSTEN_RPC_URL = `https://ropsten.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;
const RINKEBY_RPC_URL = `https://rinkeby.infura.io/v3/8f8c6eb36eb84321a9a1194ec822e8d6`;

const walletConnect = walletConnectModule();
const injectedWallets = injectedModule();

const onboard = Onboard({
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

function App() {
  const [_, setProvider] = useState<EIP1193Provider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [error, setError] = useState<any>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [network, setNetwork] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const connectWallet = async () => {
    try {
      const wallets = await onboard.connectWallet();
      setIsLoading(true);
      const { accounts, chains, provider } = wallets[0];
      setAccount(accounts[0].address);
      setChainId(chains[0].id);
      setProvider(provider);
      setIsLoading(false);
    } catch (error) {
      setError(error);
      console.log(error);
    }
  };

  const switchNetwork = async () => {
    if (network) {
      await onboard.setChain({ chainId: toHex(network) });
    }
  };

  const handleNetwork = (e: any) => {
    const id = e.target.value;
    setNetwork(Number(id));
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
    <EthersAppContext>
      <div className="App min-h-full">
        <Header />
        <button className="mt-24" onClick={connectWallet}>
          Connect wallet
        </button>
        <button className="mt-28" onClick={disconnect}>
          Disconnect wallet
        </button>
      </div>
    </EthersAppContext>
  );
}

export default App;
