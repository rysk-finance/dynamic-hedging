import type { ApolloError } from "@apollo/client";
import type { HTMLMotionProps } from "framer-motion";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

import FadeInOut from "src/animation/FadeInOut";

const errorString =
  "A fatal error occurred, please try again later - SIGABRT (Error code: 0x79759)";
const loadingStrings = [
  `Booting Rysk v1.0.0...`,
  "Fetching data from Subgraph...",
  "Loading...",
];
const timeoutStrings =
  "This seems to be taking a long time, please be patient or try coming back later.";

interface LoadingOrErrorProps extends HTMLMotionProps<"div"> {
  error?: ApolloError;
  extraStrings?: string[];
  stringSpeed?: number;
}

const LoadingOrError = ({
  error,
  extraStrings,
  stringSpeed = 400,
  ...props
}: LoadingOrErrorProps) => {
  const [visible, setVisible] = useState<string[]>([loadingStrings[0]]);

  const strings = [...loadingStrings, ...(extraStrings ? extraStrings : [])];

  useEffect(() => {
    if (!error && visible.length < strings.length) {
      const timer = setTimeout(() => {
        setVisible((visible) => [...visible, strings[visible.length]]);
      }, Math.max(Math.random() * stringSpeed, 200));

      return () => {
        clearTimeout(timer);
      };
    }

    if (error && !visible.includes(errorString)) {
      setVisible((visible) => [...visible, errorString]);
    }
  }, [error, visible]);

  useEffect(() => {
    const longTimer = setTimeout(() => {
      if (!visible.includes(timeoutStrings)) {
        setVisible((visible) => [...visible, timeoutStrings]);
      }
    }, 10000);

    return () => {
      clearTimeout(longTimer);
    };
  }, []);

  return (
    <motion.div
      {...props}
      className={`p-4 [&>code]:block ${props.className}`}
      {...FadeInOut(0.75)}
    >
      {visible.map((string) => (
        <code key={string}>{string}</code>
      ))}
    </motion.div>
  );
};

export default LoadingOrError;
