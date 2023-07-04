const Resize = (
  minHeight: number | string = 0,
  maxHeight: number | string = "auto"
) => ({
  initial: { height: minHeight },
  animate: {
    height: maxHeight,
    transition: { duration: 0.3, ease: [0.0, 0.0, 0.2, 1] },
  },
  exit: {
    height: minHeight,
    transition: { duration: 0.25, ease: [0.4, 0.0, 1, 1] },
  },
});

export default Resize;
