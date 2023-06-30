import type { SelectedOption, StrikeOptions } from "src/state/types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";

import { Loading } from "src/Icons";
import FadeInOut from "src/animation/FadeInOut";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { useShowColumn } from "../hooks/useShowColumn";
import { Cell, Delta, Exposure, IV, Position, Quote, Strike } from "./Cells";

export const Body = ({ chainRows }: { chainRows: StrikeOptions[] }) => {
  const {
    state: {
      ethPrice,
      options: { loading },
    },
    dispatch,
  } = useGlobalContext();

  const [colSize, , showCol] = useShowColumn();

  const [callAtmStrike, putAtmStrike] = useMemo(() => {
    if (chainRows.length) {
      const atmIndex = chainRows.findIndex(
        (row) => ethPrice && row.strike >= ethPrice
      );
      const maxIndex = chainRows.length - 1;

      if (atmIndex === -1) {
        return [
          chainRows[maxIndex].strike,
          chainRows[maxIndex].strike + 1,
        ] as const;
      }

      if (atmIndex === 0) {
        return [
          chainRows[atmIndex].strike - 1,
          chainRows[atmIndex].strike,
        ] as const;
      }

      return [
        chainRows[atmIndex - 1].strike,
        chainRows[atmIndex].strike,
      ] as const;
    } else {
      return [0, 0];
    }
  }, [ethPrice, chainRows]);

  const setSelectedOption = (option: SelectedOption) => () => {
    dispatch({ type: ActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <tbody
      className="relative block w-[150%] lg:w-full font-dm-mono text-sm ease-in-out duration-100 hover:[&>tr]:!opacity-100 [&>tr]:hover:!opacity-40"
      id="chain-body"
    >
      <AnimatePresence initial={false}>
        {chainRows.map((option) => {
          const callSellDisabled =
            option.call?.sell.disabled || !option.call?.sell.quote.quote;
          const callBuyDisabled =
            option.call?.buy.disabled || !option.call?.buy.quote.quote;
          const callPosDisabled =
            !option.call?.pos ||
            (option.call?.pos < 0 && callBuyDisabled) ||
            (option.call?.pos > 0 && callSellDisabled);
          const putSellDisabled =
            option.put?.sell.disabled || !option.put?.sell.quote.quote;
          const putBuyDisabled =
            option.put?.buy.disabled || !option.put?.buy.quote.quote;
          const putPosDisabled =
            !option.put?.pos ||
            (option.put?.pos < 0 && putBuyDisabled) ||
            (option.put?.pos > 0 && putSellDisabled);

          const callAtTheMoney = option.strike === callAtmStrike;
          const putAtTheMoney = option.strike === putAtmStrike;
          const rowClasses = callAtTheMoney
            ? "border-b"
            : putAtTheMoney
            ? "border-t"
            : "";

          return (
            <motion.tr
              className={`group/row grid even:bg-bone odd:bg-bone-light bg-[url('./assets/wave-lines.png')] even:bg-[top_right_-50%] even:lg:bg-[top_right_-15%] even:xl:bg-[top_right_0%] odd:bg-[top_left_-80%] odd:lg:bg-[top_left_-40%] odd:xl:bg-[top_left_-20%] bg-no-repeat bg-contain text-right [&_td]:col-span-1 [&_td]:border [&_td]:border-dashed [&_td]:border-gray-500 [&_td]:ease-in-out [&_td]:duration-100 [&_td]:text-2xs [&_td]:xl:text-sm ease-in-out duration-100 ${rowClasses} border-black border-dashed`}
              key={option.strike}
              style={{
                gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))`,
              }}
              {...FadeInOut()}
              layout="position"
            >
              {showCol("iv sell") && (
                <Cell cellClasses="!border-l-0" disabled={callSellDisabled}>
                  <IV value={option.call?.sell.IV || 0} />
                </Cell>
              )}

              <Cell
                cellClasses={`${
                  callSellDisabled
                    ? "!bg-red-100/40"
                    : "text-red-900 !bg-red-100/80"
                } !p-0`}
                disabled={callSellDisabled}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "call",
                    buyOrSell: "sell",
                    strikeOptions: option,
                  })}
                  disabled={callSellDisabled}
                  value={option.call?.sell.quote.quote || 0}
                />
              </Cell>

              <Cell
                cellClasses={`${
                  callBuyDisabled
                    ? "!bg-green-100/20"
                    : "text-green-1100 !bg-green-100/60"
                } !p-0`}
                disabled={callBuyDisabled}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "call",
                    buyOrSell: "buy",
                    strikeOptions: option,
                  })}
                  disabled={callBuyDisabled}
                  value={option.call?.buy.quote.quote || 0}
                />
              </Cell>

              {showCol("iv buy") && (
                <Cell disabled={callBuyDisabled}>
                  <IV value={option.call?.buy.IV || 0} />
                </Cell>
              )}

              {showCol("delta") && (
                <Cell disabled={callSellDisabled && callBuyDisabled}>
                  <Delta value={option.call?.delta || 0} />
                </Cell>
              )}

              {showCol("pos") && (
                <Cell
                  cellClasses="!p-0"
                  disabled={callSellDisabled && callBuyDisabled}
                >
                  <Position
                    disabled={callPosDisabled}
                    value={option.call?.pos || 0}
                  />
                </Cell>
              )}

              {showCol("exposure") && (
                <Cell
                  cellClasses="!border-r-0"
                  disabled={callSellDisabled && callBuyDisabled}
                >
                  <Exposure value={option.call?.exposure || 0} />
                </Cell>
              )}

              <Strike
                value={option.strike}
                callAtTheMoney={callAtTheMoney}
                putAtTheMoney={putAtTheMoney}
              />

              {showCol("iv sell") && (
                <Cell cellClasses="!border-l-0" disabled={putSellDisabled}>
                  <IV value={option.put?.sell.IV || 0} />
                </Cell>
              )}

              <Cell
                cellClasses={`${
                  putSellDisabled
                    ? "!bg-red-100/40"
                    : "text-red-900 !bg-red-100/80"
                } !p-0`}
                disabled={putSellDisabled}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "put",
                    buyOrSell: "sell",
                    strikeOptions: option,
                  })}
                  disabled={putSellDisabled}
                  value={option.put?.sell.quote.quote || 0}
                />
              </Cell>

              <Cell
                cellClasses={`${
                  putBuyDisabled
                    ? "!bg-green-100/20"
                    : "text-green-1100 !bg-green-100/60"
                } !p-0`}
                disabled={putBuyDisabled}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "put",
                    buyOrSell: "buy",
                    strikeOptions: option,
                  })}
                  disabled={putBuyDisabled}
                  value={option.put?.buy.quote.quote || 0}
                />
              </Cell>

              {showCol("iv buy") && (
                <Cell disabled={putBuyDisabled}>
                  <IV value={option.put?.buy.IV || 0} />
                </Cell>
              )}

              {showCol("delta") && (
                <Cell disabled={putSellDisabled && putBuyDisabled}>
                  <Delta value={option.put?.delta || 0} />
                </Cell>
              )}

              {showCol("pos") && (
                <Cell
                  cellClasses="!p-0"
                  disabled={putSellDisabled && putBuyDisabled}
                >
                  <Position
                    disabled={putPosDisabled}
                    value={option.put?.pos || 0}
                  />
                </Cell>
              )}

              {showCol("exposure") && (
                <Cell
                  cellClasses="!border-r-0"
                  disabled={putSellDisabled && putBuyDisabled}
                >
                  <Exposure value={option.put?.exposure || 0} />
                </Cell>
              )}
            </motion.tr>
          );
        })}

        {loading && (
          <motion.tr
            className="absolute inset-0 z-10 w-full h-full bg-black/10"
            key="data-loading"
            {...FadeInOut()}
          >
            <td className="h-full flex items-center">
              <Loading className="h-12 mx-auto animate-spin text-bone-light" />
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </tbody>
  );
};
