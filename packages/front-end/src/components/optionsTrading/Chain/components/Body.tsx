import type { SelectedOption, StrikeOptions } from "src/state/types";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounce } from "use-debounce";

import FadeInOut from "src/animation/FadeInOut";
import { Loading } from "src/Icons";
import { useGlobalContext } from "src/state/GlobalContext";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";
import { useShowColumn } from "../hooks/useShowColumn";
import { Cell, Delta, Exposure, IV, Position, Quote, Strike } from "./Cells";

export const Body = ({ chainRows }: { chainRows: StrikeOptions[] }) => {
  const {
    state: {
      ethPrice,
      options: { loading },
      visibleStrikeRange,
    },
  } = useGlobalContext();

  const {
    state: { selectedOption },
    dispatch,
  } = useOptionsTradingContext();

  const [_, setSearchParams] = useSearchParams();

  const [colSize, , showCol] = useShowColumn();

  const [strikeRange] = useDebounce(visibleStrikeRange, 300);

  const filteredChainRows = useMemo(
    () =>
      chainRows.filter(({ strike }) => {
        const min = Number(strikeRange[0]);
        const max = Number(strikeRange[1]);

        if (min && max) {
          return strike >= min && strike <= max;
        } else if (min) {
          return strike >= min;
        } else if (max) {
          return strike <= max;
        } else {
          return !(min && max);
        }
      }),
    [chainRows, strikeRange]
  );

  const setSelectedOption = (option: SelectedOption) => () => {
    dispatch({ type: OptionsTradingActionType.SET_SELECTED_OPTION, option });
  };

  return (
    <tbody className="relative block w-[150%] lg:w-full font-dm-mono text-sm">
      <AnimatePresence initial={false}>
        {filteredChainRows.map((option) => {
          const callBidDisabled =
            option.call.bid.disabled || !option.call.bid.quote;
          const callAskDisabled =
            option.call.ask.disabled || !option.call.ask.quote;
          const putBidDisabled =
            option.put.bid.disabled || !option.put.bid.quote;
          const putAskDisabled =
            option.put.ask.disabled || !option.put.ask.quote;

          return (
            <motion.tr
              className="grid even:bg-bone odd:bg-bone-light bg-[url('./assets/wave-lines.png')] even:bg-[top_right_-50%] even:lg:bg-[top_right_-15%] even:xl:bg-[top_right_0%] odd:bg-[top_left_-80%] odd:lg:bg-[top_left_-40%] odd:xl:bg-[top_left_-20%] bg-no-repeat bg-contain text-right [&_td]:col-span-1 [&_td]:border [&_td]:border-dashed [&_td]:border-gray-500 [&_td]:ease-in-out [&_td]:duration-100 [&_td]:cursor-default [&_td]:text-2xs [&_td]:xl:text-base"
              key={option.strike}
              style={{
                gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))`,
              }}
              {...FadeInOut()}
            >
              {showCol("bid iv") && (
                <Cell
                  cellClasses="!border-l-0 "
                  ethPrice={ethPrice}
                  option={option}
                  side="call"
                  selectedOption={selectedOption}
                >
                  <IV value={option.call.bid.IV} />
                </Cell>
              )}

              <Cell
                cellClasses={`${
                  callBidDisabled ? "text-gray-600" : "text-red-700"
                } !p-0`}
                ethPrice={ethPrice}
                option={option}
                side="call"
                selectedOption={selectedOption}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "call",
                    bidOrAsk: "bid",
                    strikeOptions: option,
                  })}
                  disabled={callBidDisabled}
                  value={option.call.bid.quote}
                />
              </Cell>

              <Cell
                cellClasses={`${
                  callAskDisabled ? "text-gray-600" : "text-green-700"
                } !p-0`}
                ethPrice={ethPrice}
                option={option}
                side="call"
                selectedOption={selectedOption}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "call",
                    bidOrAsk: "ask",
                    strikeOptions: option,
                  })}
                  disabled={callAskDisabled}
                  value={option.call.ask.quote}
                />
              </Cell>

              {showCol("ask iv") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="call"
                  selectedOption={selectedOption}
                >
                  <IV value={option.call.ask.IV} />
                </Cell>
              )}

              {showCol("delta") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="call"
                  selectedOption={selectedOption}
                >
                  <Delta value={option.call.delta} />
                </Cell>
              )}

              {showCol("pos") && (
                <Cell
                  cellClasses="!p-0"
                  ethPrice={ethPrice}
                  option={option}
                  side="call"
                  selectedOption={selectedOption}
                >
                  <Position
                    clickFn={() => {
                      setSearchParams({
                        ref: "close",
                        token: option.call.tokenID || "",
                      });
                    }}
                    disabled={!option.call.pos}
                    value={option.call.pos}
                  />
                </Cell>
              )}

              {showCol("exposure") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="call"
                  selectedOption={selectedOption}
                >
                  <Exposure value={option.call.exposure} />
                </Cell>
              )}

              <Strike value={option.strike} />

              {showCol("bid iv") && (
                <Cell
                  cellClasses="!border-l-0 "
                  ethPrice={ethPrice}
                  option={option}
                  side="put"
                  selectedOption={selectedOption}
                >
                  <IV value={option.put.bid.IV} />
                </Cell>
              )}

              <Cell
                cellClasses={`${
                  putBidDisabled ? "text-gray-600" : "text-red-700"
                } !p-0`}
                ethPrice={ethPrice}
                option={option}
                side="put"
                selectedOption={selectedOption}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "put",
                    bidOrAsk: "bid",
                    strikeOptions: option,
                  })}
                  disabled={putBidDisabled}
                  value={option.put.bid.quote}
                />
              </Cell>

              <Cell
                cellClasses={`${
                  putAskDisabled ? "text-gray-600" : "text-green-700"
                } !p-0`}
                ethPrice={ethPrice}
                option={option}
                side="put"
                selectedOption={selectedOption}
              >
                <Quote
                  clickFn={setSelectedOption({
                    callOrPut: "put",
                    bidOrAsk: "ask",
                    strikeOptions: option,
                  })}
                  disabled={putAskDisabled}
                  value={option.put.ask.quote}
                />
              </Cell>

              {showCol("ask iv") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="put"
                  selectedOption={selectedOption}
                >
                  <IV value={option.put.ask.IV} />
                </Cell>
              )}

              {showCol("delta") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="put"
                  selectedOption={selectedOption}
                >
                  <Delta value={option.put.delta} />
                </Cell>
              )}

              {showCol("pos") && (
                <Cell
                  cellClasses="!p-0"
                  ethPrice={ethPrice}
                  option={option}
                  side="put"
                  selectedOption={selectedOption}
                >
                  <Position
                    clickFn={() => {
                      setSearchParams({
                        ref: "close",
                        token: option.put.tokenID || "",
                      });
                    }}
                    disabled={!option.put.pos}
                    value={option.put.pos}
                  />
                </Cell>
              )}

              {showCol("exposure") && (
                <Cell
                  cellClasses=""
                  ethPrice={ethPrice}
                  option={option}
                  side="put"
                  selectedOption={selectedOption}
                >
                  <Exposure value={option.put.exposure} />
                </Cell>
              )}
            </motion.tr>
          );
        })}

        {loading && (
          <motion.div
            className="flex items-center absolute inset-0 z-10 w-full h-full bg-black/10"
            key="data-loading"
            {...FadeInOut()}
          >
            <Loading className="h-12 mx-auto animate-spin text-bone-light" />
          </motion.div>
        )}
      </AnimatePresence>
    </tbody>
  );
};
