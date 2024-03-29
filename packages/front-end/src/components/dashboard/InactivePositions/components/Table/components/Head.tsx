const columns = [
  "series",
  "size",
  "entry price",
  "close price",
  "p/l",
  "settlement price",
];

export const Head = () => {
  return (
    <thead className="w-[150%] lg:w-full border-b-2 border-black border-dashed pr-3">
      <tr className="grid grid-cols-6 text-center capitalize [&_th]:border-l-2 first:[&_th]:border-0 [&_th]:border-gray-500 [&_th]:border-dashed [&_th]:py-3 [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base select-none">
        {columns.map((name) => (
          <th
            className="flex items-center justify-center"
            key={name}
            scope="col"
          >
            <span>{name}</span>
          </th>
        ))}
      </tr>
    </thead>
  );
};
