import { UserVault } from "src/components/dashboard/UserVault";
import { UserOptions } from "src/components/dashboard/OptionsTable/OptionsTable";

export const Dashboard = () => {
  return (
    <div className="table col-start-1 col-end-17">
      <UserVault />
      <UserOptions />
    </div>
  );
};
