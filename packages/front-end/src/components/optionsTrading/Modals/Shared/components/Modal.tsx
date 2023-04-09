import type { MouseEvent, PropsWithChildren } from "react";

import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";
import { useOptionsTradingContext } from "src/state/OptionsTradingContext";
import { OptionsTradingActionType } from "src/state/types";

export const Modal = ({ children }: PropsWithChildren) => {
  const { dispatch } = useOptionsTradingContext();

  const handleLightBoxClick = () => {
    dispatch({
      type: OptionsTradingActionType.RESET,
    });
  };

  const handleModalClick = (event: MouseEvent) => event.stopPropagation();

  return (
    <motion.div
      className="fixed inset-0 z-50 w-screen h-screen grid grid-cols-12 bg-bone-light/80 cursor-pointer"
      onClick={handleLightBoxClick}
      title="Click to close the modal."
      {...FadeInOut(0.1)}
    >
      <motion.div
        aria-modal="true"
        className="flex flex-col col-span-8 col-start-3 lg:col-span-6 lg:col-start-4 xl:col-span-4 xl:col-start-5 my-auto border-black border-2 rounded-2xl bg-bone-light bg-[url('./assets/white-ascii-50.png')] bg-center overflow-hidden cursor-default"
        onClick={handleModalClick}
        title=""
        {...FadeInUpDelayed(0.3)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
