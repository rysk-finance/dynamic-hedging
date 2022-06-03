import React, { MutableRefObject, useCallback, useEffect, useRef } from "react";

export const useOnClickOutside = (
  elementRef: MutableRefObject<HTMLElement | null>,
  isOpen: boolean,
  callback: () => void
) => {
  const isOpenRef = useRef(false);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        isOpenRef.current &&
        elementRef.current &&
        !elementRef.current.contains(event.target as Node)
      ) {
        callback();
      }
    },
    [callback, elementRef]
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [handleClickOutside]);
};
