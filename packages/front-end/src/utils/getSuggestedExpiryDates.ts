export const getSuggestedExpiryDates = () => {
  const now = new Date();

  const nextFriday = getClosestFridayToDate(now);

  const nextMonth = new Date(now);
  nextMonth.setDate(now.getDate() + 30);
  const nextMonthFriday = getClosestFridayToDate(nextMonth);

  const threeMonths = new Date(now);
  threeMonths.setDate(now.getDate() + 90);
  const threeMonthsFriday = getClosestFridayToDate(threeMonths);

  return [nextFriday, nextMonthFriday, threeMonthsFriday];
};

export const getClosestFridayToDate = (date: Date) => {
  const dateCopy = new Date(date);
  const dayOfMonth = dateCopy.getDate();
  const dayOfWeek = dateCopy.getDay();

  // +2 as Friday is day 6 in getDay.
  const daysTillNextFriday = 7 - ((dayOfWeek + 2) % 7);

  dateCopy.setDate(dayOfMonth + daysTillNextFriday);

  dateCopy.setHours(8, 0, 0, 0);

  return dateCopy;
};
