import { UserVault } from "../components/dashboard/UserVault";
import { UserEpochPNL } from "../components/dashboard/UserEpochPNL/UserEpochPNL";
import { UserOptions } from "src/components/dashboard/OptionsTable/OptionsTable";

export const Dashboard = () => {
  return (
    <div className="table col-start-1 col-end-17">
        <UserVault />
        <UserEpochPNL />
        <UserOptions />
    </div>
  );
};
