import { Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import ApolloProvider from "./clients/Apollo/Apollo";
import WalletProvider from "./clients/WalletProvider/Wallet";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Init } from "./components/Init";
import { MobileWarning } from "./components/MobileWarning";
import { AppPaths } from "./config/appPaths";
import { useScrollToTop } from "./hooks/useScrollToTop";
import { Dashboard } from "./pages/Dashboard";
import { OTC } from "./pages/OTC";
import { OptionsTrading } from "./pages/OptionsTrading";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import { Rewards } from "./pages/Rewards";
import { TermsOfService } from "./pages/TermsOfService";
import { Vault } from "./pages/Vault";
import { GlobalContextProvider } from "./state/GlobalContext";

import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  useScrollToTop();

  return (
    <GlobalContextProvider>
      <WalletProvider>
        <ApolloProvider>
          <Init />
          <div className="bg-bone flex flex-col min-h-screen">
            <MobileWarning />
            <Header />
            <div className="px-16 overflow-hidden">
              <div className="root-grid pb-16">
                <Routes>
                  <Route path={AppPaths.DASHBOARD} element={<Dashboard />} />
                  <Route path={AppPaths.HOME} element={<OptionsTrading />} />
                  <Route path={AppPaths.OTC} element={<OTC />} />
                  <Route
                    path={AppPaths.PRIVACY_POLICY}
                    element={<PrivacyPolicy />}
                  />
                  <Route path={AppPaths.REWARDS} element={<Rewards />} />
                  <Route
                    path={AppPaths.TERMS_OF_SERVICE}
                    element={<TermsOfService />}
                  />
                  <Route path={AppPaths.TRADE} element={<OptionsTrading />} />
                  <Route path={AppPaths.VAULT} element={<Vault />} />
                  <Route
                    path={AppPaths.FALLBACK}
                    element={<Navigate to={AppPaths.HOME} />}
                  />
                </Routes>
              </div>
            </div>
            <Footer />
          </div>
          <ToastContainer
            toastClassName="bg-bone rounded-none border-2 border-black font-dm-sans text-black max-w-xl w-fit"
            hideProgressBar
            position="bottom-right"
            autoClose={10000}
          />
        </ApolloProvider>
      </WalletProvider>
    </GlobalContextProvider>
  );
}

export default App;
