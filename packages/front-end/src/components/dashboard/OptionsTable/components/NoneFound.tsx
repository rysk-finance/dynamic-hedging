import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";

const NoneFound = () => (
  <motion.p key="none-found" {...FadeInOut()} className="p-4">
    {`No positions found. Visit the Trade Options page to open positions.`}
  </motion.p>
);

export default NoneFound;
