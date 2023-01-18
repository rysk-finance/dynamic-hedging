import { useRef, useState, useEffect } from "react";

const useElementOnScreen = (options: any) => {
  // NOTE: any cause useRef doesn't match div ref prop type
  const containerRef: any = useRef<HTMLDivElement>();
  const [isVisible, setIsVisible] = useState(false);
  const callbackFunction = (entries: any) => {
    console.log(entries);
    console.log("INTERSECTING!");
    const [entry] = entries;
    setIsVisible(entry.isIntersecting);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(callbackFunction, options);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      if (containerRef.current) observer.unobserve(containerRef.current);
    };
  }, [containerRef, options]);

  return [containerRef, isVisible];
};

export default useElementOnScreen;
