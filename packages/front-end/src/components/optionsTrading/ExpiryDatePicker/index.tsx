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
  ] = useExpiryDates();

  return (
    <div className="grid grid-cols-12 items-center font-medium bg-[url('./assets/wave-lines.png')] bg-right bg-no-repeat">
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
