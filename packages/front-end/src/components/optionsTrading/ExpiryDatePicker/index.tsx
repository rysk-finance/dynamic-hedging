import { LeftArrow, RightArrow } from "src/Icons";
import { ArrowButton } from "./components/ArrowButton";
import { DateList } from "./components/DateList";
import { useExpiryDates } from "./hooks/useExpiryDates";
import { useGlobalContext } from "src/state/GlobalContext";
import { RyskTooltip } from "src/components/shared/RyskToolTip";

export const ExpiryDatePicker = () => {
  const {
    state: {
      options: { expiries },
      userTradingPreferences: { calendarMode, tutorialMode },
    },
  } = useGlobalContext();

  const [visibleRange, handleExpirySelection, scrollExpiries] =
    useExpiryDates();

  return (
    <RyskTooltip
      content="Use this section to select the expiries you wish to view. You can also use the arrows at the sides to scroll through other expiries when there are more than six available."
      disabled={!tutorialMode}
    >
      <div className="grid grid-cols-12 items-center font-medium border-b-2 border-black bg-[url('./assets/wave-lines.png')] bg-[top_right_-50%] lg:bg-[top_right_-15%] xl:bg-[top_right_0%] bg-no-repeat bg-contain">
        <ArrowButton
          onClick={scrollExpiries(-1)}
          disabled={!expiries.length || visibleRange[0] === 0}
          title="Click to see earlier expiry dates."
        >
          <LeftArrow className="w-8 h-8" />
        </ArrowButton>

        <DateList
          visibleRange={visibleRange}
          handleExpirySelection={handleExpirySelection}
        />

        <ArrowButton
          onClick={scrollExpiries(1)}
          disabled={!expiries.length || visibleRange[1] === expiries.length - 1}
          title="Click to see later expiry dates."
        >
          <RightArrow className="w-8 h-8" />
        </ArrowButton>
      </div>
    </RyskTooltip>
  );
};
