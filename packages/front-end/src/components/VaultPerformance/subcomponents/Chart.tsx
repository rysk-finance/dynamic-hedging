import type {
  ChartProps,
  CustomLegendProps,
  CustomTooltipProps,
} from "../VaultPerformance.types";

import dayjs from "dayjs";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (label && active && payload && payload.length) {
    const isHistoricalDataPoint = payload.length === 2;
    const isPredictedPrice = payload[0].payload.isPrediction;

    return (
      <div className="bg-white rounded-lg shadow-lg font-dm-mono text-center w-60">
        <p className="px-4 pt-4 pb-2 text-xl font-medium after:content-['_%']">
          {`DHV: ${
            isHistoricalDataPoint ? payload[0].value : payload[1].value
          }`}
        </p>

        <p className="px-4 pb-2 border-b-2 border-bone text-xl font-medium after:content-['_%']">
          {`ETH: ${
            isHistoricalDataPoint ? payload[1].value : payload[3].value
          }`}
        </p>

        <p className="p-2 text-sm">
          {dayjs.unix(parseInt(label)).format("DD MMM YY")}
          {isPredictedPrice
            ? " (predicted)"
            : ` (epoch ${payload[0].payload.epoch})`}
        </p>
      </div>
    );
  }

  return null;
};

const CustomLegend = ({ payload }: CustomLegendProps) => {
  if (payload && payload.length) {
    return (
      <div className="flex justify-center">
        {payload.map(({ color, value }) => {
          return value.includes("predicted") ? null : (
            <>
              <span
                className="w-2 h-2 bg-black rounded-full my-2"
                style={{ background: color }}
              />
              <p className="ml-2 mr-8">{value}</p>
            </>
          );
        })}
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
          animationDuration={1000}
          animationEasing="ease-in"
          dataKey="growthSinceFirstEpoch"
          dot={{ r: 4, fill: "black", stroke: "black" }}
          name="DHV"
          stroke="black"
          strokeWidth={2}
          type="linear"
        />
        <Line
          activeDot={{ fill: "#00FEFD", stroke: "#00FEFD" }}
          animationBegin={1000}
          animationDuration={1000}
          animationEasing="ease"
          dataKey="predictedGrowthSinceFirstEpoch"
          dot={{ r: 4, fill: "black", stroke: "black" }}
          stroke="black"
          strokeDasharray="8 8"
          strokeWidth={2}
          type="linear"
        />
        <Line
          activeDot={{ fill: "#343434", stroke: "#343434" }}
          animationDuration={1000}
          animationEasing="ease-in"
          dataKey="ethPrice"
          dot={{ r: 4, fill: "#626890", stroke: "#626890" }}
          name="Ethereum"
          stroke="#626890"
          strokeWidth={2}
          type="linear"
        />
        <Line
          activeDot={{ fill: "#343434", stroke: "#343434" }}
          animationBegin={1000}
          animationDuration={1000}
          animationEasing="ease"
          dataKey="predictedEthPrice"
          dot={{ r: 4, fill: "#626890", stroke: "#626890" }}
          stroke="#626890"
          strokeDasharray="8 8"
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
        <Legend content={<CustomLegend />} iconType="circle" />
      </LineChart>
    </ResponsiveContainer>
  </div>
);
