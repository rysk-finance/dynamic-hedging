import type { TableProps } from "../types";

import { BigNumber } from "ethers";
import { motion } from "framer-motion";
import NumberFormat from "react-number-format";

import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { Button } from "src/components/shared/Button";
import { useGlobalContext } from "src/state/GlobalContext";
import { optionSymbolFromOToken } from "src/utils";
import {
  fromOpynHumanised,
  fromUSDC,
  fromWei,
  renameOtoken,
} from "src/utils/conversion-helper";

const tableHeadings = [
  {
    children: "Side",
    className: "col-span-1 text-center",
  },
  {
    children: "Option",
    className: "col-span-1 text-center",
  },
  {
    children: "Size",
    className: "col-span-1 text-center",
  },
  {
    children: "Premium",
    className: "col-span-1 text-center",
  },
  {
    children: "Entry",
    className: "col-span-1 text-center",
  },
  {
    children: "P/L",
    className: "col-span-1 text-center",
  },
  {
    children: "Break even",
    className: "col-span-1 text-center",
  },
  {
    children: "Collateral",
    className: "col-span-2 text-center",
  },
  {
    children: (active: boolean): string =>
      active ? "Liq. price" : "Settlement",
    className: "col-span-1 text-center",
  },
  {
    children: "Status",
    className: "col-span-2 text-center",
  },
];

const Table = ({
  positions,
  completeRedeem,
  completeSettle,
  adjustCollateral,
  active,
}: TableProps) => {
  const {
    state: { ethPrice },
  } = useGlobalContext();

  return (
    <motion.table
      key="table"
      {...FadeInOut()}
      className="block [&>*]:block [&_th]:font-medium"
    >
      <thead>
        <tr className="grid grid-cols-12 text-left text-lg p-4 border-b-2 border-black ">
          {tableHeadings.map((heading) => {
            const thContent =
              typeof heading.children === "function"
                ? heading.children(active)
                : heading.children;
            return (
              <th key={thContent} className={heading.className}>
                {thContent}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>
        {positions.map(
          (
            {
              status,
              amount,
              breakEven,
              entryPrice,
              expiryPrice,
              liquidationPrice,
              id,
              isRedeemable,
              isSettleable,
              vaultId,
              otokenId,
              side,
              symbol,
              strikePrice,
              isPut,
              totalPremium,
              collateralAmount,
              expiryTimestamp,
              collateralAsset,
              pnl,
            },
            index,
            arr
          ) => (
            <motion.tr
              key={id}
              {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
              className="w-auto h-16 grid grid-cols-12 items-center px-4 ease-in-out duration-100 odd:bg-bone-light hover:bg-bone-dark"
            >
              <td
                className={`col-span-1 text-center ${
                  side === "LONG" ? "text-green-700" : "text-red-500"
                }`}
              >
                {side}
              </td>
              <td className="col-span-1 text-center text-sm">
                {symbol
                  ? renameOtoken(symbol)
                  : optionSymbolFromOToken(isPut, expiryTimestamp, strikePrice)}
              </td>
              <NumberFormat
                value={fromOpynHumanised(BigNumber.from(amount))}
                displayType={"text"}
                decimalScale={2}
                renderText={(value) => (
                  <td className="col-span-1 text-center">
                    {amount ? value : "-"}
                  </td>
                )}
              />
              <NumberFormat
                value={fromUSDC(BigNumber.from(totalPremium))}
                prefix="$ "
                displayType={"text"}
                decimalScale={2}
                renderText={(value) => (
                  <td className="col-span-1 text-center">
                    {totalPremium ? value : "-"}
                  </td>
                )}
              />
              <NumberFormat
                value={entryPrice}
                displayType={"text"}
                prefix="$ "
                decimalScale={2}
                renderText={(value) => (
                  <td className="col-span-1 text-center">
                    {Number(entryPrice) ? value : "-"}
                  </td>
                )}
              />
              <NumberFormat
                value={pnl}
                displayType={"text"}
                prefix="$ "
                decimalScale={2}
                renderText={(value) => (
                  <td
                    className={`col-span-1 text-center ${
                      pnl > 0 ? "text-green-700" : "text-red-500"
                    }`}
                  >
                    {value || "-"}
                  </td>
                )}
              />
              <NumberFormat
                value={breakEven}
                displayType={"text"}
                decimalScale={2}
                renderText={(value) => (
                  <td className="col-span-1 text-center">
                    {Number(value) ? `$ ${value}` : "-"}
                  </td>
                )}
              />
              <NumberFormat
                value={
                  // 1. If no collateral asset --> either a long or inactive short
                  // 2. Inactive short can have collateralAsset true if position vault has collateral leftover
                  collateralAsset && amount != 0
                    ? {
                        USDC: fromUSDC(collateralAmount),
                        "Wrapped Ether": fromWei(collateralAmount),
                      }[collateralAsset]
                    : null
                }
                displayType={"text"}
                prefix={collateralAsset === "USDC" ? "$ " : "Ξ "}
                decimalScale={2}
                renderText={(value) => (
                  <td className="col-span-2 text-center">
                    {value && !isSettleable ? (
                      <Button
                        color="white"
                        onClick={() => adjustCollateral(arr[index])}
                        className="min-w-[80%]"
                        title="Click to adjust"
                      >
                        {value}
                      </Button>
                    ) : (
                      "-"
                    )}
                  </td>
                )}
              />
              <NumberFormat
                value={
                  active ? liquidationPrice : fromOpynHumanised(expiryPrice)
                }
                displayType={"text"}
                decimalScale={2}
                renderText={(value) => {
                  const price = Number(value);
                  const threshold = 1.03;
                  const inDanger = ethPrice
                    ? isPut
                      ? ethPrice < price * threshold
                      : ethPrice > price / threshold
                    : false;

                  return (
                    <td
                      className={`col-span-1 text-center ${
                        inDanger ? "text-red-500" : "text-black"
                      }`}
                    >
                      {liquidationPrice ? `$ ${value}` : "-"}
                    </td>
                  );
                }}
              />
              {isRedeemable || isSettleable ? (
                <td className="col-span-2 text-center">
                  <Button
                    onClick={() =>
                      isRedeemable
                        ? completeRedeem(otokenId, amount)
                        : completeSettle(vaultId)
                    }
                    className="min-w-[80%]"
                    title={`Click to ${isRedeemable ? "Redeem" : "Settle"}`}
                  >
                    {isRedeemable ? `Redeem` : `Settle`}
                  </Button>
                </td>
              ) : (
                <td className="col-span-2 text-center">{status}</td>
              )}
            </motion.tr>
          )
        )}
      </tbody>
    </motion.table>
  );
};

export default Table;
