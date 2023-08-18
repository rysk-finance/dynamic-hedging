import type { ChartProps, CustomTooltipProps } from "../VaultPerformance.types";

import dayjs from "dayjs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (label && active && payload && payload.length) {
    const [dhv, eth] = payload;

    return (
      <div className="bg-white rounded-lg shadow-lg font-dm-mono text-center w-60">
        <p className="px-4 pt-4 pb-2 text-xl font-medium after:content-['_%']">
          {`DHV: ${dhv.value}`}
        </p>
        <p className="px-4 pb-2 border-b-2 border-bone text-xl font-medium after:content-['_%']">
          {`ETH: ${eth.value}`}
        </p>
        <p className="p-2 text-sm">
          {dayjs.unix(parseInt(label)).format("DD MMM YY")}
        </p>
      </div>
    );
  }

  return null;
};

export const Chart = ({ chartData }: ChartProps) => (
  <div className="p-8" role="graphics-document">
    <ResponsiveContainer width={"100%"} height={384}>
      <LineChart data={chartData}>
        <Line
          activeDot={{ fill: "#00FEFD", stroke: "#00FEFD" }}
          dataKey="growthSinceFirstEpoch"
          dot={{ r: 4, fill: "black", stroke: "black" }}
          name="DHV"
          stroke="black"
          strokeWidth={2}
          type="linear"
        />
        <Line
          activeDot={{ fill: "#343434", stroke: "#343434" }}
          dataKey="ethPrice"
          dot={{ r: 4, fill: "#626890", stroke: "#626890" }}
          name="Ethereum"
          stroke="#626890"
          strokeWidth={2}
          type="linear"
        />
        <XAxis
          stroke="black"
          strokeWidth={2}
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          dataKey="timestamp"
          angle={0}
          minTickGap={16}
          tickFormatter={(value: string) =>
            dayjs.unix(parseInt(value)).format("DD MMM")
          }
          padding={{ left: 16, right: 16 }}
        />
        <YAxis
          stroke="black"
          strokeWidth={2}
          padding={{ top: 16, bottom: 16 }}
          tickFormatter={(value: string) => `${value}%`}
        />
        <Tooltip content={<CustomTooltip />} cursor={false} />
        <Legend iconType="circle" />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
