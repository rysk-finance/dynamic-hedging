import Humanize from "humanize-duration";
import { useCallback, useEffect, useState } from "react";

const UPDATE_INTERVAL_MS = 60000;

const getClosestEpoch = () => {
  const currentDate = new Date(1663911312002);
  // Clone currentDate.
  const closestFriday = new Date(currentDate.getTime());

  const msInWeek = 1000 * 60 * 60 * 24 * 7;

  const currentDayOfWeek = currentDate.getUTCDay();

  const daysTillNextFriday = 7 - ((currentDayOfWeek + 2) % 7);

  closestFriday.setUTCDate(currentDate.getUTCDate() + daysTillNextFriday);
  closestFriday.setUTCHours(11, 0, 0, 0);

  const msUntilEpoch =
    (closestFriday.getTime() - currentDate.getTime()) % msInWeek;

  const closestEpoch = new Date(currentDate.getTime() + msUntilEpoch);

  return closestEpoch;
};

export const useTimeTilEpoch = () => {
  const [updateInterval, setUpdateInterval] = useState<NodeJS.Timer | null>(
    null
  );
  const [msTilNextFriday, setMsTilNextFriday] = useState(() => {
    const nextFriday = getClosestEpoch();
    return nextFriday.getTime() - new Date().getTime();
  });

  const updateTime = useCallback(() => {
    const nextFriday = getClosestEpoch();
    setMsTilNextFriday(nextFriday.getTime() - new Date().getTime());
  }, []);

  useEffect(() => {
    if (!updateInterval) {
      const interval = setInterval(updateTime, UPDATE_INTERVAL_MS);
      setUpdateInterval(interval);
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
        setUpdateInterval(null);
      }
    };
  }, [updateTime, updateInterval]);

  return Humanize(msTilNextFriday, {
    units: ["d", "h", "m"],
    maxDecimalPoints: 0,
  });
};
