import { ApolloClient, ApolloProvider, InMemoryCache } from "@apollo/client";
import * as Fathom from "fathom-client";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import WalletProvider from "./clients/WalletProvider/Wallet";
import Favicon from "./components/Favicon";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { MobileWarning } from "./components/MobileWarning";
import { AppPaths } from "./config/appPaths";
import { Dashboard } from "./pages/Dashboard";
import { OptionsTrading } from "./pages/OptionsTrading";
import { OTC } from "./pages/OTC";
import { Vault } from "./pages/Vault";
import { GlobalContextProvider } from "./state/GlobalContext";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

/////////////////////////////////////////////
// - Move Apollo into its own client file. //
// - Clean up App file.                    //
/////////////////////////////////////////////

function App() {
  // Initialising to a client with undefined URL, rather than just null, as ApolloProvider
  // expects client to always be non-null. We overwrite with a new client with a defined
  // uri in a useEffect below.
  const [apolloClient, setApolloClient] = useState(
    new ApolloClient({
      uri: undefined,
      cache: new InMemoryCache(),
    })
  );

  // useEffect(() => {
  //   const SUBGRAPH_URI =
  //     network?.id !== undefined
  //       ? SUBGRAPH_URL[network?.id]
  //       : process.env.REACT_APP_NETWORK === ETHNetwork.ARBITRUM_MAINNET
  //       ? SUBGRAPH_URL[CHAINID.ARBITRUM_MAINNET]
  //       : SUBGRAPH_URL[CHAINID.ARBITRUM_GOERLI];

  //   const OPYN_SUBGRAPH_URI =
  //     network?.id !== undefined
  //       ? OPYN_SUBGRAPH_URL[network?.id]
  //       : process.env.REACT_APP_NETWORK === ETHNetwork.ARBITRUM_MAINNET
  //       ? OPYN_SUBGRAPH_URL[CHAINID.ARBITRUM_MAINNET]
  //       : OPYN_SUBGRAPH_URL[CHAINID.ARBITRUM_GOERLI];

  //   const ryskSubgraph = new HttpLink({
  //     uri: SUBGRAPH_URI,
  //   });

  //   const opynSubgraph = new HttpLink({
  //     uri: OPYN_SUBGRAPH_URI,
  //   });

  //   const client = new ApolloClient({
  //     link: ApolloLink.split(
  //       (operation) => operation.getContext().clientName === "opyn",
  //       opynSubgraph, // <= apollo will send to this if clientName is "opyn"
  //       ryskSubgraph // <= otherwise will send to this
  //     ),
  //     cache: new InMemoryCache({
  //       typePolicies: {
  //         Query: {
  //           fields: {
  //             writeOptionsActions: {
  //               keyArgs: false,
  //               merge(existing = [], incoming) {
  //                 return [...existing, ...incoming];
  //               },
  //             },
  //             buybackOptionActions: {
  //               keyArgs: false,
  //               merge(existing = [], incoming) {
  //                 return [...existing, ...incoming];
  //               },
  //             },
  //             rebalanceDeltaActions: {
  //               keyArgs: false,
  //               merge(existing = [], incoming) {
  //                 return [...existing, ...incoming];
  //               },
  //             },
  //           },
  //         },
  //       },
  //     }),
  //   });

  //   setApolloClient(client);
  // }, [network?.id]);

  useEffect(() => {
    // Initialize Fathom when the app loads
    // Example: yourdomain.com
    //  - Do not include https://
    //  - This must be an exact match of your domain.
    //  - If you're using www. for your domain, make sure you include that here.
    Fathom.load("SMDEXJZR", { excludedDomains: ["localhost:3000"] });
  }, []);

  return (
    <GlobalContextProvider>
      <WalletProvider>
        <ApolloProvider client={apolloClient}>
          <div className="App bg-bone flex flex-col min-h-screen">
            <Favicon />
            {process.env.REACT_APP_ENV !== "production" && (
              <Helmet>
                <meta name="robots" content="noindex, nofollow"></meta>
              </Helmet>
            )}

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
            toastClassName="bg-bone rounded-none border-2 border-black font-dm-sans text-black max-w-xl w-fit"
            hideProgressBar
            position="bottom-center"
            autoClose={5000}
          />
        </ApolloProvider>
      </WalletProvider>
    </GlobalContextProvider>
  );
}

export default App;
