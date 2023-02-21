import { LeftArrow, RightArrow } from "src/Icons";
import { ArrowButton } from "./components/ArrowButton";
import { DateList } from "./components/DateList";
import { useExpiryDates } from "./hooks/useExpiryDates";

export const ExpiryDatePicker = () => {
  const [
    expiryDate,
    expiryDates,
    visibleRange,
    handleExpirySelection,
    scrollExpiries,
    balances,
  ] = useExpiryDates();

  return (
    <div className="grid grid-cols-12 items-center font-medium bg-[url('./assets/wave-lines.png')] bg-[top_right_-50%] lg:bg-[top_right_-15%] xl:bg-[top_right_0%] bg-no-repeat">
      <ArrowButton
        onClick={scrollExpiries(-1)}
        disabled={!expiryDates.length || visibleRange[0] === 0}
        title="Click to see earlier expiry dates."
      >
        <LeftArrow className="w-8 h-8" />
      </ArrowButton>

      <DateList
        expiryDates={expiryDates}
        visibleRange={visibleRange}
        expiryDate={expiryDate}
        handleExpirySelection={handleExpirySelection}
        balances={balances}
      />

      <ArrowButton
        onClick={scrollExpiries(1)}
        disabled={
          !expiryDates.length || visibleRange[1] === expiryDates.length - 1
        }
        title="Click to see later expiry dates."
      >
        <RightArrow className="w-8 h-8" />
      </ArrowButton>
    </div>
  );
};
