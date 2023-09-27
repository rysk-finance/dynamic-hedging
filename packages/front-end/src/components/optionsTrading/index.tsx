import { AnimatePresence, LayoutGroup } from "framer-motion";
import { useMemo } from "react";

import { OptionChainModalActions } from "src/state/types";

import { useHourUpdate } from "src/components/optionsTrading/hooks/useHourUpdate";
import { AssetPriceInfo } from "./AssetPriceInfo";
import { Chain } from "./Chain";
import { ExpiryDatePicker } from "./ExpiryDatePicker";
import { Filters } from "./Filters/Filters";
import { AdjustCollateralModal } from "./Modals/AdjustCollateralModal";
import { BuyOptionModal } from "./Modals/BuyOptionModal";
import { CloseOptionModal } from "./Modals/CloseOptionModal";
import { CloseShortOptionModal } from "./Modals/CloseShortOptionModal";
import { LongStraddleStrangleModal } from "./Modals/LongStraddleStrangleModal";
import { OperatorModal } from "./Modals/OperatorModal";
import { SellOptionModal } from "./Modals/SellOptionModal";
import { SpreadModal } from "./Modals/SpreadModal";
import { Strategies } from "./Strategies";
import { UserStats } from "./UserStats";
import { useModal } from "./hooks/useModal";

export const OptionsTradingContent = () => {
  const [modalType] = useModal();

  useHourUpdate();

  const visibleModal = useMemo(() => {
    const {
      ADJUST_COLLATERAL,
      BUY,
      CLOSE_LONG,
      CLOSE_SHORT,
      LONG_STRADDLE,
      LONG_STRANGLE,
      OPERATOR,
      SELL,
    } = OptionChainModalActions;

    switch (modalType) {
      case ADJUST_COLLATERAL:
        return <AdjustCollateralModal key={modalType} />;

      case BUY:
        return <BuyOptionModal key={modalType} />;

      case CLOSE_LONG:
        return <CloseOptionModal key={modalType} />;

      case CLOSE_SHORT:
        return <CloseShortOptionModal key={modalType} />;

      case LONG_STRADDLE:
        return (
          <LongStraddleStrangleModal key={modalType} strategy={LONG_STRADDLE} />
        );

      case LONG_STRANGLE:
        return (
          <LongStraddleStrangleModal key={modalType} strategy={LONG_STRANGLE} />
        );

      case OPERATOR:
        return <OperatorModal key={modalType} />;

      case SELL:
        return <SellOptionModal key={modalType} />;

      default:
        return null;
    }
  }, [modalType]);

  return (
    <>
      <section className="col-start-1 col-end-17">
        <AssetPriceInfo />

        <LayoutGroup>
          <div className="relative border-2 border-black rounded-lg overflow-hidden">
            <ExpiryDatePicker />
            <Filters />
            <Strategies />
            <Chain />
          </div>
        </LayoutGroup>

        <AnimatePresence mode="wait">{visibleModal}</AnimatePresence>
      </section>

      <UserStats />
    </>
  );
};
