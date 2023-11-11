import type { TableProps } from "../types";

import { useAccount } from "wagmi";

import { ARB } from "src/Icons";
import { RyskCountUp } from "src/components/shared/RyskCountUp";
import { Convert } from "src/utils/Convert";
import { shorthandContractAddress } from "src/utils/helpers";
import { TOTAl_RECIPIENTS } from "../constants";

export const Table = ({ recipients }: TableProps) => {
  const { address } = useAccount();

  return (
    <section className="bg-[url('./assets/white-ascii-50.png')] bg-fixed">
      <table className="block [&>*]:block text-lg border-2 border-black rounded-lg">
        <thead className="w-full border-b-2 border-black border-dashed">
          <tr className="grid grid-cols-4 text-center [&_th]:border-l-2 first:[&_th]:border-0 [&_th]:border-gray-500 [&_th]:border-dashed [&_th]:py-3 [&_th]:text-lg">
            <th scope="col">{`Rank`}</th>
            <th scope="col">{`Address`}</th>
            <th scope="col">{`Received`}</th>
            <th scope="col">{`Total value*`}</th>
          </tr>
        </thead>

        <tbody>
          {recipients.map(({ id, totalTokens, totalValue }, index) => {
            const isUser = id === address?.toLowerCase();
            const position = index < TOTAl_RECIPIENTS ? `# ${index + 1}` : "";

            return (
              <tr
                className="relative grid grid-cols-4 items-center text-center font-dm-mono [&_td]:h-11 [&_td]:z-10 [&_td]:flex [&_td]:items-center [&_td]:justify-center [&_td]:border-b [&_td]:border-l-2 first:[&_td]:border-l-0 [&_td]:border-x-gray-500 [&_td]:border-dashed [&_td]:text-base [&_td]:p-0"
                key={id}
              >
                {isUser && (
                  <td className="absolute w-full bg-cyan/20 animate-pulse" />
                )}
                <td>{position}</td>
                <td>{shorthandContractAddress(id)}</td>
                <td>
                  <ARB className="w-6 h-6 m-auto flex-1 pl-8" />
                  <p className="m-auto flex-1 pr-8">
                    <RyskCountUp value={Convert.fromWei(totalTokens).toInt()} />
                  </p>
                </td>
                <td>
                  <RyskCountUp
                    prefix="$ "
                    value={Convert.fromStr(totalValue).toInt()}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};
