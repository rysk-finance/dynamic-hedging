import type { RyskCountUpProps } from "./types";

import { useEffect, useState } from "react";
import { CountUp } from "use-count-up";

import { RyskCountUpDecimals } from "./constants";

export const RyskCountUp = ({
  value = 0,
  fallback = "-",
  format = "USD",
}: RyskCountUpProps) => {
  const [end, setEnd] = useState(0);
  const [key, setKey] = useState(crypto.randomUUID());
  const [start, setStart] = useState(0);

  useEffect(() => {
    if (value) {
      setStart(end);
      setEnd(value);
      setKey(crypto.randomUUID());
    } else {
      setStart(0);
      setEnd(0);
    }
  }, [value]);

  if (!value) {
    return <>{fallback}</>;
  }

  return (
    <CountUp
      decimalPlaces={RyskCountUpDecimals[format]}
      decimalSeparator={"."}
      duration={0.3}
      easing="easeOutCubic"
      end={end}
      isCounting={Boolean(value)}
      key={key}
      start={start}
      thousandsSeparator={","}
    />
  );
};
