import type { PropsWithChildren } from "react";

import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";
import FadeInUpDelayed from "src/animation/FadeInUpDelayed";

export const Modal = ({ children }: PropsWithChildren) => (
  <motion.div
    className="fixed inset-0 z-50 w-screen h-screen grid grid-cols-12 bg-bone-light/80"
    {...FadeInOut(0.1)}
  >
    <motion.div
      aria-modal="true"
      className="flex flex-col col-span-4 col-start-5 my-auto border-black border-2 rounded-2xl bg-bone-light bg-[url('./assets/white-ascii-50.png')] bg-center overflow-hidden"
      {...FadeInUpDelayed(0.3)}
    >
      {children}
    </motion.div>
  </motion.div>
);
