import React from "react";
import {VaultStats} from './VaultStats'
import {VaultChart} from './VaultChart'
import { AlphaBanner } from "./shared/AlphaBanner";

export const VaultPerformance = () => {
  return (
    <div>
      <AlphaBanner />
      <VaultStats />
      <VaultChart />
    </div>
  );
};
