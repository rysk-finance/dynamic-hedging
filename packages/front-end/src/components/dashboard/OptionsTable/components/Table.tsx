import type { TableProps } from "../types";

import { BigNumber } from "ethers";
import { motion } from "framer-motion";
import NumberFormat from "react-number-format";

import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { renameOtoken, fromUSDC, fromWei } from "src/utils/conversion-helper";
import { fromOpynHumanised } from "src/utils/conversion-helper";
import { Button } from "src/components/shared/Button";

const tableHeadings = [
  {
    children: "Side",
    className: "col-span-1",
  },
  {
    children: "Option",
    className: "col-span-2",
  },
  {
    children: "Size",
    className: "col-span-1 text-right",
  },
  {
    children: "Premium",
    className: "col-span-1 text-right",
  },
  {
    children: "Entry",
    className: "col-span-1 text-right",
  },
  {
    children: (active: boolean): string => (active ? "P/L" : "Settlement"),
    className: "col-span-1 text-right",
  },
  {
    children: "Collateral",
    className: "col-span-2 text-right",
  },
  {
    children: "Liq. price",
    className: "col-span-1 text-right",
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
}: TableProps) => (
  <motion.table
    key="table"
    {...FadeInOut()}
    className="block [&>*]:block [&_th]:font-medium"
  >
    <thead>
      <tr className="grid grid-cols-12 gap-4 text-left text-lg p-4 border-b-2 border-black ">
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
            totalPremium,
            collateralAmount,
            collateralAsset,
            pnl,
          },
          index
        ) => (
          <motion.tr
            key={id}
            {...FadeInUpDelayed(Math.min(index * 0.1, 2))}
            className="w-auto h-16 grid grid-cols-12 gap-4 items-center px-4 ease-in-out duration-100 odd:bg-bone-light  hover:bg-bone-dark"
          >
            <td
              className={`col-span-1 ${
                side === "LONG" ? "text-green-700" : "text-red-500"
              }`}
            >
              {side}
            </td>
            <td className="col-span-2">{renameOtoken(symbol)}</td>
            <NumberFormat
              value={fromOpynHumanised(BigNumber.from(amount))}
              displayType={"text"}
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-1 text-right">
                  {amount ? value : "-"}
                </td>
              )}
            />
            <NumberFormat
              value={fromUSDC(BigNumber.from(totalPremium))}
              prefix="$"
              displayType={"text"}
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-1 text-right">
                  {totalPremium ? value : "-"}
                </td>
              )}
            />
            <NumberFormat
              value={entryPrice}
              displayType={"text"}
              prefix="$"
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-1 text-right">
                  {Number(entryPrice) ? value : "-"}
                </td>
              )}
            />
            {/** P/L if active or Settlement if inactive */}
            <NumberFormat
              value={active ? pnl : fromOpynHumanised(expiryPrice)}
              displayType={"text"}
              prefix="$"
              decimalScale={2}
              renderText={(value) => (
                <td
                  className={`col-span-1 ${
                    active ? (pnl > 0 ? "text-green-700" : "text-red-500") : ""
                  } text-right`}
                >
                  {value || "-"}
                </td>
              )}
            />
            <NumberFormat
              value={
                collateralAsset
                  ? {
                      USDC: fromUSDC(collateralAmount),
                      WETH: fromWei(collateralAmount),
                    }[collateralAsset]
                  : null
              }
              displayType={"text"}
              prefix={collateralAsset === "USDC" ? "$" : "Ξ"}
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-2 text-right">
                  {value && !isSettleable ? (
                    <Button
                      color="white"
                      onClick={adjustCollateral}
                      className="min-w-[50%]"
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
              value={liquidationPrice}
              displayType={"text"}
              decimalScale={2}
              prefix={"$"}
              renderText={(value) => (
                <td className="col-span-1 text-right">
                  {liquidationPrice ? value : "-"}
                </td>
              )}
            />
            {isRedeemable || isSettleable ? (
              <td className="col-span-2 text-center">
                <Button
                  onClick={() =>
                    isRedeemable
                      ? completeRedeem(otokenId, amount)
                      : completeSettle(vaultId)
                  }
                  className="min-w-[50%]"
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

export default Table;
