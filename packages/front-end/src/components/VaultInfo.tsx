import React from "react";
import { useContract } from "../hooks/useContract";
import LPABI from "../abis/LiquidityPool.json";
import { SCAN_URL } from "../config/constants";
import { useVaultContext } from "../state/VaultContext";
import { BigNumberDisplay } from "./BigNumberDisplay";
import { Currency } from "../types";
import moment from "moment";


export const VaultInfo = () => { 

  const {
    state: { currentEpoch, currentPricePerShare, userRyskBalance },
  } = useVaultContext();

  function getNextFriday(date = new Date()) {
    const dateCopy = new Date(date.getTime());

    // TODO change based on epoch
    // assuming Friday 11am UTC epoch
    const nextDate = dateCopy.getDay() !== 5 || ( dateCopy.getDay() === 5 && dateCopy.getUTCHours() > 10 )  ? 
      new Date(
        dateCopy.setDate(
          dateCopy.getDate() + ((7 - dateCopy.getDay() + 5) % 7 || 7),
        ),
      ) :
      dateCopy


    return moment(nextDate).format('MMMM Do YYYY');
  }

  const [lpContract] = useContract({ contract: "liquidityPool", ABI: LPABI, readOnly: true });

  return (
    <div className="pb-8 py-12 px-8">
      <div className="grid grid-cols-2">

        <div>
          <h4>DHV</h4>
          <p className="mt-4">
            Chain: Arbitrum
          </p>
          <p className="mt-4">
            Current Epoch: {currentEpoch?.toString()}
          </p>
          <p className="mt-4">
            DHV Share Price:{" "}
            <BigNumberDisplay
              currency={Currency.RYSK}
              numberFormatProps={{ decimalScale: 4 }}
              suffix="USDC"
            >
              {currentPricePerShare}
            </BigNumberDisplay>
          </p>
          <p className="mt-4">
            {/* TODO add next epoch start */}
            Next Epoch Start: { getNextFriday(new Date()) } 11:00 UTC
          </p>
        </div>


        <div>
          <h4>Addresses</h4>
          <p className="mt-4">
            DHV: {" "} 
            <a href={`${SCAN_URL}/address/${lpContract?.address}`} className="underline hover:font-medium"> { lpContract?.address } </a>
          </p>
        </div>

      </div>

    </div>
  );
};
