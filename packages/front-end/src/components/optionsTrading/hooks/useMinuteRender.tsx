import dayjs from "dayjs";
import { useEffect, useState } from "react";

/**
 * This hook causes a state update at the top of every minute to allow
 * components to be forcibly re-rendered.
 *
 * @returns void
 */
export const useMinuteRender = () => {
  const [, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (dayjs().second() === 59) setCount((count) => ++count);
    }, 1000);

    return () => clearInterval(interval);
  }, []);
};
