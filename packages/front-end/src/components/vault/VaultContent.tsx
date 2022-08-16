import React from "react";
import { BigNumberDisplay } from "../../components/BigNumberDisplay";
import { LPStats } from "../../components/LPStats";
import { Card } from "../../components/shared/Card";
import { VaultDeposit } from "./VaultDesposit";
import { VaultPerformance } from "../../components/VaultPerformance";
import { useVaultContext } from "../../state/VaultContext";
import { Currency } from "../../types";
import { RequiresWalletConnection } from "../RequiresWalletConnection";
import { VaultWithdraw } from "./VaultWithdraw";
import { VaultStrategy } from "../VaultStrategy";
import { VaultRisks } from "../VaultRisks";
import { VaultInfo } from "../VaultInfo";
import { DHV_NAME } from "../../config/constants";
import * as Scroll from 'react-scroll';


export const VaultContent = () => {
  const {
    state: { currentEpoch, currentPricePerShare, userRyskBalance },
  } = useVaultContext();

  const Link = Scroll.Link;
  const Element   = Scroll.Element;

  return (
    <>
      {/* <div className="w-full flex justify-between bg-black text-white items-center p-4 col-start-1 col-end-17 mb-16">  
        <h4>
          DHV Balance:{" "}
          <RequiresWalletConnection className="bg-white h-8 w-[100px]">
            <BigNumberDisplay currency={Currency.RYSK}>
              {userRyskBalance}
            </BigNumberDisplay>
          </RequiresWalletConnection>
        </h4>
        <h4>Current Epoch: {currentEpoch?.toString()}</h4>
        <h4>
          DHV Share Price:{" "}
          <BigNumberDisplay
            currency={Currency.RYSK}
            numberFormatProps={{ decimalScale: 4 }}
            suffix="USDC"
          >
            {currentPricePerShare}
          </BigNumberDisplay>
        </h4>
      </div> */}

      <div className="col-start-1 col-end-8">

        <div className="font-parabole mb-8">
          <h1>{DHV_NAME}</h1>
          <h3 className="pt-4">Dynamic Hedging Vault</h3>
        </div>
        
        <p>
          {DHV_NAME} generates uncorrelated returns on USDC by
          running short options strategies (such as strangles, straddles, or single legs) targeting delta neutrality
          to reduce the directional risk associated with price movements in the underlying asset. 
          <br />
          If the portfolio delta moves far away from zero the {DHV_NAME} position 
          will be hedged by trading options, spot or perpetuals.
          < br/>
          <Link 
            className="underline hover:font-medium cursor-pointer"
            activeClass="active" 
            to="overviewScroll" 
            spy={true} 
            smooth={true} 
            offset={-150} 
            duration={500}
            >
            Learn more
          </Link>
        </p>
        
        <LPStats />
        
      </div>

      <div className="col-start-9 col-end-17">
        <Card
          tabs={[
            {
              label: "Deposit",
              content: <VaultDeposit />,
            },
            { label: "Withdraw", content: <VaultWithdraw /> },
          ]}
        ></Card>
      </div>

      <Element name="overviewScroll" className="col-start-1 col-end-17 mt-16">
          <Card
            tabs={[
              { 
                label: "Overview", 
                content: <VaultStrategy /> 
              },
              {
                label: "Performance",
                content: <VaultPerformance />,
              },
              { 
                label: "Risks", 
                content: <VaultRisks /> 
              },
              { 
                label: "Info", 
                content: <VaultInfo /> 
              },
            ]}
          ></Card>
      </Element> 


    </>
  );
};
