import type { MouseEvent } from "react";

import type { RyskModalProps } from "./types";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";

export const RyskModal = ({ children, lightBoxClickFn }: RyskModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle("overflow-y-scroll", true);
    document.body.classList.toggle("fixed", true);

    return () => {
      document.body.classList.toggle("overflow-y-scroll", false);
      document.body.classList.toggle("fixed", false);
    };
  }, []);

  const handleModalClick = (event: MouseEvent) => event.stopPropagation();

  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  }, [modalRef]);

  return (
    <motion.div
      className="fixed inset-0 z-50 w-screen h-screen grid grid-cols-12 bg-bone-light/80 cursor-pointer overflow-auto"
      onClick={lightBoxClickFn}
      title="Click to close the modal."
      {...FadeInOut(0.1)}
    >
      <motion.div
        aria-modal="true"
        className="flex flex-col col-span-8 col-start-3 lg:col-span-6 lg:col-start-4 my-auto border-black border-2 rounded-2xl bg-bone-light bg-[url('./assets/white-ascii-50.png')] bg-center overflow-auto cursor-default max-h-[90%] rysk-scrollbar"
        onClick={handleModalClick}
        ref={modalRef}
        title=""
        {...FadeInUpDelayed(0.3)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
