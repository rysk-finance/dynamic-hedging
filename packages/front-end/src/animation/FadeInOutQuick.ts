const FadeInOutQuick = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: [0.0, 0.0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: [0.4, 0.0, 1, 1] },
  },
};

export default FadeInOutQuick;
