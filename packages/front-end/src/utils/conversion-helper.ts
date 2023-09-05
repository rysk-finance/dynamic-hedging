export function truncate(num: number, places: number = 3): number {
  return (
    Math.trunc(Math.round(num * Math.pow(10, places))) / Math.pow(10, places)
  );
}
