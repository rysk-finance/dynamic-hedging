import { DashboardContent } from "../components/dashboard";
import { GlobalContextProvider } from "../state/GlobalContext";

export const Dashboard = () => {
  return (
    <GlobalContextProvider>
      <DashboardContent />
    </GlobalContextProvider>
  );
};
