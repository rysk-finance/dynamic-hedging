import { motion } from "framer-motion";

import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";

export const Error = () => (
  <motion.div className="w-full m-auto" {...FadeInOutFixedDelay}>
    {`We're having some trouble fetching Ethereum price data. Please hold tight and we should have it soon!`}
  </motion.div>
);
