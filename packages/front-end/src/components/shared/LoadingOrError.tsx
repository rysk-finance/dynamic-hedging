import type { ApolloError } from "@apollo/client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import FadeInOut from "src/animation/FadeInOut";

const errorString =
  "A fatal error occurred, please try again later - SIGABRT (Error code: 0x79759)";
const loadingStrings = [
  `Booting Rysk v1.0.0...`,
  "Fetching data from Subgraph...",
  "Loading...",
];

const LoadingOrError = ({
  error,
  extraStrings,
}: {
  error?: ApolloError;
  extraStrings?: string[];
}) => {
  const [visible, setVisible] = useState<string[]>([loadingStrings[0]]);

  const strings = [...loadingStrings, ...(extraStrings ? extraStrings : [])];

  useEffect(() => {
    if (!error && visible.length < strings.length) {
      const timer = setTimeout(() => {
        setVisible((visible) => [...visible, strings[visible.length]]);
      }, Math.max(Math.random() * 400, 200));

      return () => {
        clearTimeout(timer);
      };
    }

    if (error && !visible.includes(errorString)) {
      setVisible((visible) => [...visible, errorString]);
    }
  }, [error, visible]);

  return (
    <motion.div className="p-4 [&>code]:block" {...FadeInOut(0.75)}>
      {visible.map((string) => (
        <code key={string}>{string}</code>
      ))}
    </motion.div>
  );
};

export default LoadingOrError;
