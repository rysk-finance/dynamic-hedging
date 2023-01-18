import { UserVault } from "../components/dashboard/UserVault";
import { UserOptionsList } from "../components/dashboard/UserOptionsList";

export const Dashboard = () => {
  return (
    <div className="col-start-1 col-end-17">
      <div className="w-full mb-24">
        <UserVault />

        <UserOptionsList />
      </div>
    </div>
  );
};
