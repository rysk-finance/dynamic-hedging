import { LeftArrow, RightArrow } from "src/Icons";
import { ArrowButton } from "./components/ArrowButton";
import { DateList } from "./components/DateList";
import { useExpiryDates } from "./hooks/useExpiryDates";
import { useGlobalContext } from "src/state/GlobalContext";

export const ExpiryDatePicker = () => {
  const {
    state: {
      calendarMode,
      options: { expiries },
    },
  } = useGlobalContext();

  const [visibleRange, handleExpirySelection, scrollExpiries] =
    useExpiryDates();

  return (
    <>
      {calendarMode ? null : (
        <div
          className="grid grid-cols-12 items-center font-medium bg-[url('./assets/wave-lines.png')] bg-[top_right_-50%] lg:bg-[top_right_-15%] xl:bg-[top_right_0%] bg-no-repeat bg-contain border-b-2 border-black"
          id="expiry-data-picker"
        >
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
            disabled={
              !expiries.length || visibleRange[1] === expiries.length - 1
            }
            title="Click to see later expiry dates."
          >
            <RightArrow className="w-8 h-8" />
          </ArrowButton>
        </div>
      )}
    </>
  );
};
