import type {
  CustomTooltipProps,
  DepositAction,
  InitiateWithdrawAction,
  PNL,
  PricePerShare,
  QueryData,
} from "./UserEpochPNL.types";

import { gql, useQuery } from "@apollo/client";
import dayjs from "dayjs";
import { BigNumber, utils } from "ethers/lib/ethers";
import { useState } from "react";
import NumberFormat from "react-number-format";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAccount } from "wagmi";

import { QueriesEnum } from "src/clients/Apollo/Queries";
import { BIG_NUMBER_DECIMALS, DECIMALS } from "../../../config/constants";
import { baseRyskToUsdc } from "../../../utils/conversion-helper";
import { Card } from "../../shared/Card";

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (label && active && payload && payload.length) {
    const date = dayjs.unix(parseInt(label)).format("DD MMM YY");

    return (
      <div className="custom-tooltip bg-bone bg-opacity-75 border-black p-4 border-2 border-b-2 rounded-xl border-black">
        <p>{date}</p>
        <p className="label">
          P/L :{" "}
          <NumberFormat
            value={payload[0].value}
            displayType={"text"}
            decimalScale={2}
            prefix="$"
            renderText={(value) => value}
          />
        </p>
      </div>
    );
  }

  return null;
};

const CustomDWLabel = ({
  x,
  y,
  value,
}: {
  x: number;
  y: number;
  value: number;
}) => {
  if (value === 0) {
    return null;
  }

  return (
    <>
      <g fill="grey" transform={`rotate(-90, ${x}, ${y})`}>
        <text
          x={x}
          y={y}
          dy={15}
          dx={value > 0 ? -50 : 50}
          fill={value > 0 ? "green" : "red"}
          fontSize={14}
          textAnchor="middle"
        >
          ${value.toFixed(2)}
        </text>
      </g>
    </>
  );
};

export const UserEpochPNL = () => {
  const { address } = useAccount();

  const [historicalPNL, setHistoricalPNL] = useState<PNL[]>();

  // NOTE: why initiateWithdrawActions instead of completeWithdrawActions?
  // using this query because we need to get the epoch number (not present in withdrawActions)
  // the users' withdrawal receipt holds the epoch number (that matches when it was initiated + 1)
  // so it will be processed at that price per share, not latest
  // and there is no way for user to reverse the withdrawal action
  useQuery<QueryData>(
    gql`
            query ${QueriesEnum.USER_EPOCH_PNL} {
                pricePerShares (orderBy: timestamp) {
                    id
                    growthSinceFirstEpoch
                    value
                    timestamp
                }
                initiateWithdrawActions (where: { address: "${address}" }){
                    id
                    amount
                    epoch
                }
                depositActions (where: { address: "${address}" }) {
                    id
                    amount
                    epoch
                    timestamp
                }
            }
        `,
    {
      onCompleted: async (data) => {
        const amountsByEpoch: {
          [epoch: string]: {
            collateralDeposit?: string;
            sharesWithdraw?: string;
          };
        } = {};

        if (
          data.pricePerShares &&
          data.initiateWithdrawActions &&
          data.depositActions
        ) {
          const ppsWithdrawTimestamps: string[] = data.pricePerShares.map(
            ({ timestamp }: PricePerShare) => timestamp
          );

          data.initiateWithdrawActions.map(
            (deposit: InitiateWithdrawAction) => {
              amountsByEpoch[deposit.epoch] = {
                sharesWithdraw: amountsByEpoch[deposit.epoch]?.sharesWithdraw
                  ? // in case user has multiple withdraws in the same epoch
                    BigNumber.from(amountsByEpoch[deposit.epoch].sharesWithdraw)
                      // confusing naming, this amount is actually number of shares not collateral
                      .add(BigNumber.from(deposit.amount))
                      .toString()
                  : deposit.amount,
              };
            }
          );

          data.depositActions.map((deposit: DepositAction) => {
            // find the corresponding withdrawal epoch
            const index = ppsWithdrawTimestamps.findIndex(
              (el) => Number(el) > Number(deposit.timestamp)
            );

            // NOTE: if epoch is not found, it means there is no corresponding withdrawal
            // and so we just add those deposits to an upcoming withdrawal epoch
            // this is because we are just using withdraw epochs to plot pnl
            // as deposit epochs are not present in the graph
            const epochMapping =
              (index === -1 ? ppsWithdrawTimestamps.length : index) + 1;

            amountsByEpoch[epochMapping] = {
              ...amountsByEpoch[deposit.epoch],
              collateralDeposit: amountsByEpoch[deposit.epoch]
                ?.collateralDeposit
                ? // in case user has multiple deposits in the same epoch
                  BigNumber.from(
                    amountsByEpoch[deposit.epoch].collateralDeposit
                  )
                    .add(BigNumber.from(deposit.amount))
                    .toString()
                : deposit.amount,
            };
          });

          const tempPNL: PNL[] = [];

          data.pricePerShares.forEach(
            (ppsEpoch: PricePerShare, i: number, values: PricePerShare[]) => {
              const dateLocale = dayjs
                .unix(parseInt(ppsEpoch.timestamp))
                .format("DD/MM/YYYY");

              // pps price is 18 decimals and usdc deposits are 6 decimals

              const collateralDeposit =
                amountsByEpoch[ppsEpoch.id]?.collateralDeposit || "0";

              const sharesWithdraw =
                amountsByEpoch[ppsEpoch.id]?.sharesWithdraw || "0";

              const sharesWithdrawAsCollateral = baseRyskToUsdc(
                BigNumber.from(sharesWithdraw)
                  .mul(ppsEpoch.value) // withdrawalEpochPricePerShare
                  .div(BIG_NUMBER_DECIMALS.RYSK) // back to RYSK (18) based
              ); // now USDC (6) based

              const collateralDepositInRyskDecimals = BigNumber.from(
                collateralDeposit
              ).mul(BIG_NUMBER_DECIMALS.RYSK.div(BIG_NUMBER_DECIMALS.USDC));

              // Deposit / PPS = Number of Shares deposited
              const iShares = collateralDepositInRyskDecimals
                .mul(BIG_NUMBER_DECIMALS.RYSK) // multiply to RYSK (18) decimals
                .div(BigNumber.from(ppsEpoch.value)); // division keeps 18 decimals

              // calculated number of shares for collateral remove any withdrawn shares
              const s = iShares
                .sub(BigNumber.from(sharesWithdraw))
                .add(BigNumber.from(tempPNL[i - 1]?.shares || 0));

              const pnl = baseRyskToUsdc(
                BigNumber.from(ppsEpoch.value) // current epoch PPS
                  .sub(BigNumber.from(values[i - 1]?.value || 0)) // previous epoch PPS
                  .mul(BigNumber.from(tempPNL[i - 1]?.shares || 0)) // previous epoch Shares
                  .div(BIG_NUMBER_DECIMALS.RYSK) // RYSK (18) based
              ); // now USDC (6) based

              const totalPNL = pnl.add(
                BigNumber.from(tempPNL[i - 1]?.pnl || 0)
              );

              tempPNL.push({
                shares: s.toString(),
                change: BigNumber.from(collateralDeposit)
                  .sub(sharesWithdrawAsCollateral)
                  .toString(),
                pnl: totalPNL.toString(),
                timestamp: ppsEpoch.timestamp,
                dateLocale: dateLocale,
                epoch: ppsEpoch.id,
              });
            }
          );

          tempPNL.length > 0 && setHistoricalPNL(tempPNL);
        }
      },
    }
  );

  // we decided to hide the tab completely if there is no PNL
  if (!historicalPNL || historicalPNL[historicalPNL.length - 1]?.pnl == "0") {
    return null;
  }

  return (
    <div className="mb-24">
      <Card
        tabWidth={280}
        tabs={[
          {
            label: "RYSK.P/L",
            content: (
              <div className="pb-8 py-12 px-8 flex flex-col lg:flex-row h-full">
                <div className="flex h-full w-full justify-around">
                  <ResponsiveContainer width={"95%"} height={400}>
                    <ComposedChart
                      data={historicalPNL}
                      margin={{ top: 5, right: 40, bottom: 5, left: 20 }}
                    >
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" />
                      <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                      <YAxis
                        yAxisId="left"
                        tickFormatter={(value: string) => `$${value}`}
                      />
                      <Line
                        name="P/L"
                        yAxisId="left"
                        type="monotone"
                        dataKey={({ pnl }) =>
                          parseFloat(utils.formatUnits(pnl, DECIMALS.USDC))
                        }
                        // TODO access color throw Tailwind helpers
                        stroke="black"
                        strokeWidth={2}
                        dot={false}
                        legendType="line"
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        hide={true}
                      />
                      {/** TODO might want to show Line of user USDC position over epochs */}
                      <Bar
                        name="Deposits/Withdrawals"
                        legendType="none"
                        yAxisId="right"
                        /** TODO bar size doesn't work with current scale and type on xAxis */
                        barSize={20}
                        fill={"#64748b"}
                        dataKey={({ change }) =>
                          parseFloat(utils.formatUnits(change, DECIMALS.USDC))
                        }
                        label={({ x, y, value }) => (
                          <CustomDWLabel x={x} y={y} value={value} />
                        )}
                      />
                      <XAxis
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        dataKey="timestamp"
                        angle={0}
                        minTickGap={15}
                        tickFormatter={(value: string) => {
                          return dayjs.unix(parseInt(value)).format("DD MMM");
                        }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ),
          },
        ]}
      ></Card>
    </div>
  );
};
