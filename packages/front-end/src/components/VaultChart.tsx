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
  { value: 0, uv: 400, pv: 2400, amt: 2400 },
  { value: 1, uv: 540, pv: 2400, amt: 2400 },
  { value: 2, uv: 600, pv: 2400, amt: 2400 },
  { value: 3, uv: 700, pv: 2400, amt: 2400 },
  { value: 4, uv: 200, pv: 2400, amt: 2400 },
  { value: 5, uv: 100, pv: 2400, amt: 2400 },
];

export const VaultChart = () => {
  return (
    <Card tabPunchColor="bone" headerContent="DHV.performance">
      <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
        <div className="flex h-full w-full justify-around">
          <ResponsiveContainer width={"95%"} height={400}>
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
            >
              <Line type="monotone" dataKey="uv" stroke="black" />
              <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
              <XAxis dataKey="name" label={"Date"} angle={90} />
              <YAxis>
                <Label
                  angle={-90}
                  value="Performance"
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
