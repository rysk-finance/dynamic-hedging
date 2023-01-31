import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";

const Disconnected = () => (
  <motion.p key="disconnected" {...FadeInOut()} className="p-4">
    {"Please connect a wallet to view your options."}
  </motion.p>
);

export default Disconnected;
