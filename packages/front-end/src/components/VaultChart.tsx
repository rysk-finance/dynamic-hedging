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
  { date: "Jul 1", cumulativeYield: 0.41, pv: 2400, amt: 2400 },
  { date: "Jul 8", cumulativeYield: 0.94, pv: 2400, amt: 2400 },
  { date: "Jul 15", cumulativeYield: 0.67, pv: 2400, amt: 2400 },
  { date: "Jul 22", cumulativeYield: 1.2, pv: 2400, amt: 2400 },
  { date: "Jul 29", cumulativeYield: 1.93, pv: 2400, amt: 2400 },
  { date: "Aug 6", cumulativeYield: 2.24, pv: 2400, amt: 2400 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip bg-bone bg-opacity-75 border-black p-4 border-2 border-b-2 rounded-xl border-black">
        <p className="label">{`${label}: ${payload[0].value}%`}</p>
      </div>
    );
  }

  return null;
};

export const VaultChart = () => {
  return (
    <Card
      tabWidth={260}
      tabs={[
        {
          label: "DHV.cumulativeYield(%)",
          content: (
            <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
              <div className="flex h-full w-full justify-around">
                <ResponsiveContainer width={"95%"} height={400}>
                  <LineChart
                    data={data}
                    margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
                  >
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeYield"
                      stroke="black"
                    />
                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                    <XAxis dataKey="date" angle={-45} />
                    <YAxis>
                      <Label
                        angle={-90}
                        value="Cumulative Yield (%)"
                        position="center"
                        dx={-20}
                      />
                    </YAxis>
                    <Tooltip />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ),
        },
      ]}
    ></Card>
  );
};
