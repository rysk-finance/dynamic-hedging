import { Helmet } from "react-helmet";
import { Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import ApolloProvider from "./clients/Apollo/Apollo";
import WalletProvider from "./clients/WalletProvider/Wallet";
import Favicon from "./components/Favicon";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Init } from "./components/Init";
import { MobileWarning } from "./components/MobileWarning";
import { AppPaths } from "./config/appPaths";
import { Dashboard } from "./pages/Dashboard";
import { OptionsTrading } from "./pages/OptionsTrading";
import { OTC } from "./pages/OTC";
import { Vault } from "./pages/Vault";
import { GlobalContextProvider } from "./state/GlobalContext";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  return (
    <GlobalContextProvider>
      <WalletProvider>
        <ApolloProvider>
          <Init />
          <div className="App bg-bone flex flex-col min-h-screen">
            <Favicon />
            {process.env.REACT_APP_ENV !== "production" && (
              <Helmet>
                <meta name="robots" content="noindex, nofollow"></meta>
              </Helmet>
            )}

            <MobileWarning />
            <Header />
            <div className="pt-16 px-16 overflow-hidden">
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
