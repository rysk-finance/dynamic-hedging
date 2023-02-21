export const easeOutCubic = (t: number, b: number, c: number, d: number) =>
c * ((t = t / d - 1) * t * t + 1) + b;