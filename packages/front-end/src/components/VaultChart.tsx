import React from "react";
import { Card } from "./shared/Card";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";
const data = [
  { date: "jun 1", yield: 0.03, pv: 2400, amt: 2400 },
  { date: "jun 2", yield: 0.07, pv: 2400, amt: 2400 },
  { date: "jun 3", yield: 0.11, pv: 2400, amt: 2400 },
  { date: "jun 4", yield: 0.07, pv: 2400, amt: 2400 },
  { date: "jun 5", yield: 0.13, pv: 2400, amt: 2400 },
  { date: "jun 6", yield: 0.13, pv: 2400, amt: 2400 },
];

export const VaultChart = () => {
  return (
    <Card tabPunchColor="bone" headerContent="DHV.cumulativeYield(%)">
      <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
        <div className="flex h-full w-full justify-around">
          <ResponsiveContainer width={"95%"} height={400}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <Line type="monotone" dataKey="yield" stroke="black" />
              <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
              <XAxis dataKey="date" angle={0} />
              <YAxis>
                <Label
                  angle={-90}
                  // value="Cumulative Yield (%)"
                  position="center"
                  dx={-20}
                />
              </YAxis>
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};
