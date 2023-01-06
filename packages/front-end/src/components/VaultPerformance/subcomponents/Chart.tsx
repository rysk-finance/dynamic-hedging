import type { ChartProps, CustomTooltipProps } from "../VaultPerformance.types";

import dayjs from "dayjs";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (label && active && payload && payload.length) {
    return (
      <div
        className="custom-tooltip bg-bone bg-opacity-90 border-black p-4 border-2 rounded-xl"
        role="dialog"
      >
        <p>{dayjs.unix(parseInt(label)).format("DD MMM YY")}</p>
        <p className="label">{`Yield: ${payload[0].value}%`}</p>
        <p className="label">{`Epoch: ${payload[0].payload.epoch}`}</p>
      </div>
    );
  }

  return null;
};

export const Chart = ({ chartData }: ChartProps) => (
  <div
    className="p-8 flex flex-col lg:flex-row h-full justify-around"
    role="graphics-document"
  >
    <ResponsiveContainer width={"100%"} height={400} className="">
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 40, bottom: 5, left: 20 }}
      >
        <Line
          type="natural"
          dataKey="growthSinceFirstEpoch"
          // TODO access color through Tailwind helpers
          stroke="black"
          strokeWidth={2}
        />
        <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
        <XAxis
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          dataKey="timestamp"
          angle={0}
          minTickGap={16}
          tickFormatter={(value: string) =>
            dayjs.unix(parseInt(value)).format("DD MMM")
          }
        />
        <YAxis tickFormatter={(value: string) => `${value}%`} />
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" formatter={() => "Cumulative Yield"} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
