import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";

const NoneFound = () => (
  <motion.p key="none-found" {...FadeInOut()} className="p-4">
    {`No positions found. Why not contact the Rysk team to open one?`}
  </motion.p>
);

export default NoneFound;
