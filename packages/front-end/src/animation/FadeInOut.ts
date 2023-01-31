const FadeInOut = (outDelay: number = 0) => ({
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    transition: { delay: outDelay, duration: 0.25, ease: [0.4, 0.0, 1, 1] },
  },
});

export default FadeInOut;
