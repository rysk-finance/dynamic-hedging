const FadeInUpDelayed = (delay: number) => ({
  initial: { opacity: 0, translateY: 32 },
  animate: {
    opacity: 1,
    translateY: 0,
    transition: { delay, duration: 0.2, ease: [0.0, 0.0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    translateY: 32,
    transition: { duration: 0.15, ease: [0.4, 0.0, 1, 1] },
  },
});

export default FadeInUpDelayed;
