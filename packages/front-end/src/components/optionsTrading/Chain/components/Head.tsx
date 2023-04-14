import dayjs from "dayjs";

import { useShowColumn } from "../hooks/useShowColumn";
import { useGlobalContext } from "src/state/GlobalContext";

interface HeadProps {
  expiry?: string;
}

export const Head = ({ expiry }: HeadProps) => {
  const {
    state: {
      options: { activeExpiry },
    },
  } = useGlobalContext();

  const [colSize, sideSize, showCol] = useShowColumn();

  const columns = [
    {
      label: "IV (Sell)",
      visible: showCol("iv sell"),
    },
    {
      label: "Sell",
      visible: true,
    },
    {
      label: "Buy",
      visible: true,
    },
    {
      label: "IV (Buy)",
      visible: showCol("iv buy"),
    },
    {
      label: "Delta",
      visible: showCol("delta"),
    },
    {
      label: "Pos",
      visible: showCol("pos"),
    },
    {
      label: "DHV",
      visible: showCol("exposure"),
    },
  ];

  return (
    <thead className="block w-[150%] lg:w-full border-t-2 border-black">
      <tr
        className="grid bg-bone-dark [&_th]:text-sm [&_th]:xl:text-base [&_th]:py-3 [&_th]:px-0"
        style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
      >
        <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
          {`CALLS`}
        </th>

        <th className="col-span-1">
          {activeExpiry &&
            dayjs.unix(Number(expiry || activeExpiry)).format("DD MMM YY")}
        </th>

        <th style={{ gridColumn: `span ${sideSize} / span ${sideSize}` }}>
          {`PUTS`}
        </th>
      </tr>

      <tr
        className="grid [&_th]:col-span-1 [&_th]:text-xs [&_th]:lg:text-sm [&_th]:xl:text-base [&_th]:py-3"
        style={{ gridTemplateColumns: `repeat(${colSize}, minmax(0, 1fr))` }}
      >
        {columns.map(
          ({ label, visible }) =>
            visible && <th key={`${label}-call`}>{label}</th>
        )}

        <th className="bg-bone-dark">{`Strike`}</th>

        {columns.map(
          ({ label, visible }) =>
            visible && <th key={`${label}-put`}>{label}</th>
        )}
      </tr>
    </thead>
  );
};
