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
  active?: boolean,
  payload?: Array<{ value: string, length: number }>,
  label?: string
}


const CustomTooltip = ({ active, payload, label }: CustomTooltipT) => {
  if (label && active && payload && payload.length) {
    const date = new Date(label)
    return (
      <div className="custom-tooltip bg-bone bg-opacity-75 border-black p-4 border-2 border-b-2 rounded-xl border-black">
        <p>
          {date.toLocaleString('default', {month: 'short', day: '2-digit', year: '2-digit' })}
        </p>
        <p className="label">
          Yield : {' '}
          <NumberFormat
              value={payload[0].value}
              displayType={"text"}
              decimalScale={2}
              suffix="%"
          />
        </p>
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
          const refinedData = data?.pricePerShares ?
              data.pricePerShares.map((ppsEpoch: any) => {
              return ({
                epoch: ppsEpoch.id,
                growthSinceFirstEpoch: ppsEpoch.growthSinceFirstEpoch,
                timestamp: new Date(parseInt(ppsEpoch.timestamp) * 1000).toISOString()
              })
          }) : [];

          refinedData.length > 0 && setPricePerShares(refinedData);
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
              type="monotone"
              dataKey="growthSinceFirstEpoch"
              // TODO access color throw Tailwind helpers
              stroke="black"
              strokeWidth={2}
            />
            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
            <XAxis dataKey="timestamp" angle={0} tickFormatter={(value: string) => {
              const date = new Date(value)
              return date.toLocaleString('default', { month: 'short', day:'2-digit' });
            }} />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend
                verticalAlign="bottom"
                formatter={() => 'Yield'}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
