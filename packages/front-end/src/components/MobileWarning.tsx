import { useCallback, useEffect, useState } from "react";

const OVERFLOW_HIDDEN_CLASS = "overflow-hidden";
const MIN_WIDTH = 768;

export const MobileWarning = () => {
  const [isActive, setIsActive] = useState(false);

  const resizeHandler = useCallback(() => {
    if (window.innerWidth < MIN_WIDTH && !isActive) {
      setIsActive(true);
    } else if (window.innerWidth >= MIN_WIDTH && isActive) {
      setIsActive(false);
    }
  }, [isActive]);

  useEffect(() => {
    resizeHandler();
    window.addEventListener("resize", resizeHandler);

    return () => window.removeEventListener("resize", resizeHandler);
  }, [resizeHandler]);

  useEffect(() => {
    if (isActive !== null) {
      if (!isActive) {
        document.body.classList.remove(OVERFLOW_HIDDEN_CLASS);
      } else if (!document.body.classList.contains(OVERFLOW_HIDDEN_CLASS)) {
        document.body.classList.add(OVERFLOW_HIDDEN_CLASS);
      }
    }
  }, [isActive]);

  return isActive ? (
    <div className="fixed w-screen h-screen z-[10000] bg-bone flex flex-col items-center justify-center p-4">
      <img src={"/logo.png"} alt="logo" className="w-20 mb-8" />
      <p className="text-center">
        Rysk doesn&apos;t support mobile currently. Please visit back on desktop
        to continue.
      </p>
    </div>
  ) : null;
};
