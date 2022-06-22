import { MutableRefObject, useCallback, useEffect, useRef } from "react";

export const useOnClickOutside = (
  elementRef: MutableRefObject<HTMLElement | null>,
  isOpen: boolean,
  callback: () => void,
  customPredicate?: (element: HTMLElement | null, event: MouseEvent) => boolean
) => {
  const isOpenRef = useRef(false);

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        isOpenRef.current &&
        elementRef.current &&
        (customPredicate
          ? customPredicate(elementRef.current, event)
          : !elementRef.current.contains(event.target as Node))
      ) {
        callback();
      }
    },
    [callback, elementRef, customPredicate]
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
