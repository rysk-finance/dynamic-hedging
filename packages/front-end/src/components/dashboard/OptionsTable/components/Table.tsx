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
    children: "Settlement",
    className: "col-span-2 text-right",
  },
  {
    children: "Collateral",
    className: "col-span-2 text-right",
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
}: TableProps) => (
  <motion.table
    key="table"
    {...FadeInOut()}
    className="block [&>*]:block [&_th]:font-medium"
  >
    <thead>
      <tr className="grid grid-cols-12 gap-4 text-left text-lg p-4 border-b-2 border-black ">
        {tableHeadings.map((heading) => (
          <th key={heading.children} {...heading} />
        ))}
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
            <NumberFormat
              value={fromOpynHumanised(expiryPrice)}
              displayType={"text"}
              prefix="$"
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-2 text-right">{value || "-"}</td>
              )}
            />
            <NumberFormat
              value={
                collateralAsset
                  ? {
                      ["USDC"]: fromUSDC(collateralAmount),
                      ["WETH"]: fromWei(collateralAmount),
                    }[collateralAsset]
                  : null
              }
              displayType={"text"}
              prefix={`${collateralAsset} `}
              decimalScale={2}
              renderText={(value) => (
                <td className="col-span-2 text-right">
                  {value ? (
                    <Button
                      color="white"
                      onClick={() => adjustCollateral(vaultId)}
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
            {isRedeemable || isSettleable ? (
              <td className="col-span-2 text-center">
                <Button
                  onClick={() =>
                    isRedeemable
                      ? completeRedeem(otokenId, amount)
                      : completeSettle(vaultId)
                  }
                  className="min-w-[50%]"
                  title="Click to redeem"
                >
                  {isRedeemable ? `Redeem` : `Settle`}
                </Button>
              </td>
            ) : (
              <td className="col-span-2 text-center text-sm">{status}</td>
            )}
          </motion.tr>
        )
      )}
    </tbody>
  </motion.table>
);

export default Table;
