import type { OptionChainModal } from "src/state/types";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { strategyList } from "./strategyList";

export const Strategies = () => {
  const { dispatch } = useGlobalContext();

  const handleClick = (modal: OptionChainModal) => () => {
    dispatch({
      type: ActionType.SET_OPTION_CHAIN_MODAL_VISIBLE,
      visible: modal,
    });
  };

  return (
    <div className="grid grid-cols-12">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 col-span-9 lg:col-span-10 h-14 overflow-hidden">
        {strategyList.map(({ description, Icon, label, modal }) => (
          <button
            className="flex justify-center py-1 group/icon"
            key={label}
            onClick={handleClick(modal)}
          >
            <Icon className="h-12 mr-1" />
            <span className="w-32">
              <p className="font-dm-mono text-sm">{label}</p>
              <small className="block text-2xs !leading-1">{description}</small>
            </span>
          </button>
        ))}
      </div>

      <button
        className="grid col-span-3 lg:col-span-2 items-center border-black border-l-2 font-dm-mono p-2"
        disabled
      >
        <p className="text-sm">{`More Strategies Coming Soon...`}</p>
      </button>
    </div>
  );
};
