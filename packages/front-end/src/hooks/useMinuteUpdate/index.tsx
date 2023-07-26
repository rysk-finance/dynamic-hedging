import dayjs from "dayjs";
import { useEffect, useState } from "react";

/**
 * This hook is designed to cause a state update at the top of every minute.
 *
 * The initial early timer effect begins by checking the time every second
 * until it finds seconds equal to zero. Once this happens, a state update is
 * triggered in the form of a counter update.
 *
 * Once the counter his been incremented once, the early timer effect is
 * disabled and the long timer effect kicks off. This long timer only fires
 * every minute and also increments the counter.
 *
 * This two stage approach leads to a forced state update for timer UIs every
 * minute (much like a cron job) without the need to run interval based checks
 * every second for the life time of the component.
 *
 * @returns [number]
 */
export const useMinuteUpdate = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!count) {
      const earlyTimer = setInterval(() => {
        if (dayjs().second() === 0) setCount(1);
      }, 1000);

      return () => {
        clearInterval(earlyTimer);
      };
    }
  }, [count]);

  useEffect(() => {
    if (count) {
      const longTimer = setInterval(() => {
        setCount((count) => ++count);
      }, 60000);

      return () => {
        clearInterval(longTimer);
      };
    }
  }, [count]);

  return [count];
};
