import React, { useState } from "react";
import { Button } from "../components/shared/Button";
import { Card } from "../components/shared/Card";
import { RadioButtonSlider } from "../components/shared/RadioButtonSlider";
import { Option } from "../types";
import { SUBGRAPH_URL } from "../config/constants";
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
