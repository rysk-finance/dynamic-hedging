import React from "react";
import {VaultStats} from './VaultStats'
import {VaultChart} from './VaultChart'
// import { AlphaBanner } from "./shared/AlphaBanner";

export const VaultPerformance = () => {
  return (
    <div>
      {/* <div className="px-8 mt-8">
        <AlphaBanner />
      </div> */}
      <VaultStats />
      <VaultChart />
    </div>
  );
};
