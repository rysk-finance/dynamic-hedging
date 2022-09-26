import { useEffect } from "react";
import LPABI from "../../abis/LiquidityPool.json";
import addresses from "../../contracts.json";
import { useContract } from "../../hooks/useContract";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";

export const SetOptionParams = () => {
  const {
    dispatch,
    state: { optionParams },
  } = useOptionsTradingContext();

  const [lpContract] = useContract({
    contract: "liquidityPool",
    ABI: LPABI,
    readOnly: false,
  });

  useEffect(() => {
    if (lpContract) {
      const getOptionParams = async () => {
        const params = await lpContract.optionParams();
        if (params) {
          dispatch({
            type: OptionsTradingActionType.SET_OPTION_PARAMS,
            params,
          });
        }
      };

      getOptionParams();
    }
  }, [lpContract, dispatch]);

  return null;
};
