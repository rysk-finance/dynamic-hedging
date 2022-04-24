export const formatShortDate = (date: Date) => {
  return Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  }).format(date);
};
