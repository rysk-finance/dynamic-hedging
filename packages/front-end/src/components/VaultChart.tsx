import React, { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import NumberFormat from "react-number-format";
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

interface CustomTooltipT {
  active?: boolean;
  payload?: Array<{
    value: string;
    length: number;
    payload: { epoch: Array<string> };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipT) => {
  if (label && active && payload && payload.length) {
    const date = new Date(parseInt(label) * 1000);
    return (
      <div className="custom-tooltip bg-bone bg-opacity-75 border-black p-4 border-2 border-b-2 rounded-xl border-black">
        <p>
          {date.toLocaleString("default", {
            month: "short",
            day: "2-digit",
            year: "2-digit",
          })}
        </p>
        <p className="label">
          Yield :{" "}
          <NumberFormat
            value={payload[0].value}
            displayType={"text"}
            decimalScale={2}
            suffix="%"
          />
        </p>
        <p className="label">Epoch : {payload[0].payload.epoch.toString()}</p>
      </div>
    );
  }

  return null;
};

export const VaultChart = () => {
  const [pricePerShares, setPricePerShares] = useState<any[]>();

  useQuery(
    gql`
      query {
        pricePerShares(first: 1000) {
          id
          epoch
          value
          growthSinceFirstEpoch
          timestamp
        }
      }
    `,
    {
      onCompleted: (data) => {
        const refinedData: any = data?.pricePerShares
          ? data.pricePerShares.map((ppsEpoch: any) => {
              const dateLocale = new Date(
                parseInt(ppsEpoch.timestamp) * 1000
              ).toLocaleString("default", {
                month: "numeric",
                day: "numeric",
                year: "numeric",
              });

              return {
                epoch: ppsEpoch.id,
                growthSinceFirstEpoch: parseFloat(
                  ppsEpoch.growthSinceFirstEpoch
                ),
                timestamp: ppsEpoch.timestamp,
                dateLocale,
              };
            })
          : [];

        Object.keys(refinedData).length > 0 &&
          setPricePerShares(Object.values(refinedData));
      },
      onError: (err) => {
        console.log(err);
      },
    }
  );

  return (
    <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
      <div className="flex h-full w-full justify-around">
        <ResponsiveContainer width={"95%"} height={400}>
          <LineChart
            data={pricePerShares}
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
              minTickGap={15}
              tickFormatter={(value: string) => {
                const date = new Date(parseInt(value) * 1000);
                return date.toLocaleString("default", {
                  month: "short",
                  day: "2-digit",
                });
              }}
            />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              formatter={() => "Cumulative Yield"}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
