import type { OptionSeries, StrikeOptions } from "../../state/types";

import { gql, useQuery } from "@apollo/client";
import { captureException } from "@sentry/react";
import { BigNumber, utils } from "ethers";
import { useEffect, useState } from "react";
import { useAccount, useContract, useProvider } from "wagmi";
import { AnimatePresence, motion } from "framer-motion";

import { AlphaPortfolioValuesFeedABI } from "src/abis/AlphaPortfolioValuesFeed_ABI";
import { BeyondPricerABI } from "src/abis/BeyondPricer_ABI";
import { OptionCatalogueABI } from "src/abis/OptionCatalogue_ABI";
import { QueriesEnum } from "src/clients/Apollo/Queries";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";
import { useGraphPolling } from "src/hooks/useGraphPolling";
import { toTwoDecimalPlaces } from "src/utils/rounding";
import { useGlobalContext } from "../../state/GlobalContext";
import { useOptionsTradingContext } from "../../state/OptionsTradingContext";
import { OptionsTradingActionType } from "../../state/types";
import {
  fromOpynToNumber,
  fromWei,
  tFormatUSDC,
  toWei,
} from "../../utils/conversion-helper";
import {
  calculateOptionDeltaLocally,
  getContractAddress,
  returnIVFromQuote,
} from "../../utils/helpers";
import { Body } from "./Chain/components/Body";
import { Head } from "./Chain/components/Head";
import LoadingOrError from "../shared/LoadingOrError";
import FadeInOut from "src/animation/FadeInOut";

export const OptionsTable = () => {
  const { address } = useAccount();
  const provider = useProvider();

  const {
    state: { ethPrice },
  } = useGlobalContext();

  const {
    state: { optionType, customOptionStrikes, expiryDate, chainData },
    dispatch,
  } = useOptionsTradingContext();

  const [chainRows, setChainRows] = useState<StrikeOptions[]>([]);

  // TODO: Type this properly when I refactor this file.
  const {
    data: userData,
    error,
    startPolling,
  } = useQuery(
    gql`
      query ${QueriesEnum.USER_BALANCE_DATA} ($address: String) {
        account(id: $address) {
          balances {
            token {
              isPut
              expiryTimestamp
              strikePrice
            }
            balance
          }
        }
      }
    `,
    {
      onError: (err) => {
        captureException(err);
        console.error(err);
      },
      variables: {
        address: address?.toLowerCase(),
      },
      skip: !address,
    }
  );

  useGraphPolling(userData, startPolling);

  const beyondPricer = useContract({
    address: getContractAddress("beyondPricer"),
    abi: BeyondPricerABI,
    signerOrProvider: provider,
  });

  const portfolioValuesFeed = useContract({
    address: getContractAddress("portfolioValuesFeed"),
    abi: AlphaPortfolioValuesFeedABI,
    signerOrProvider: provider,
  });

  const optionCatalogue = useContract({
    address: getContractAddress("optionCatalogue"),
    abi: OptionCatalogueABI,
    signerOrProvider: provider,
  });

  useEffect(() => {
    if (
      ethPrice &&
      expiryDate &&
      optionCatalogue &&
      portfolioValuesFeed &&
      beyondPricer
    ) {
      if (chainData[expiryDate]) {
        setChainRows(chainData[expiryDate]);
      }

      const bigNumberExpiry = BigNumber.from(expiryDate);

      const fetchPrices = async () => {
        const strikeData = await Promise.all([
          optionCatalogue.getOptionDetails(bigNumberExpiry, false),
          optionCatalogue.getOptionDetails(bigNumberExpiry, true),
        ]);

        const strikes = new Set(strikeData.flat().map(String));

        const optionsChainRows = await Promise.all(
          Array.from(strikes).map(async (strike) => {
            const oHashCall = utils.solidityKeccak256(
              ["uint64", "uint128", "bool"],
              [expiryDate, strike, false]
            ) as HexString;
            const oHashPut: HexString = utils.solidityKeccak256(
              ["uint64", "uint128", "bool"],
              [expiryDate, strike, true]
            ) as HexString;

            const callAvailability = await optionCatalogue.getOptionStores(
              oHashCall
            );
            const putAvailability = await optionCatalogue.getOptionStores(
              oHashPut
            );

            const callExposure = await portfolioValuesFeed.netDhvExposure(
              oHashCall
            );
            const putExposure = await portfolioValuesFeed.netDhvExposure(
              oHashPut
            );

            const optionSeriesCall: OptionSeries = {
              expiration: bigNumberExpiry,
              strike: BigNumber.from(strike),
              strikeAsset: getContractAddress("USDC"),
              underlying: getContractAddress("WETH"),
              collateral: getContractAddress("USDC"),
              isPut: false,
            };

            const optionSeriesPut: OptionSeries = {
              ...optionSeriesCall,
              isPut: true,
            };

            const _getQuoteTotal = async (
              series: OptionSeries,
              netDhvExposure: BigNumber,
              isSell: boolean = false
            ) => {
              const quote = await beyondPricer.quoteOptionPrice(
                series,
                toWei((1).toString()), // 1 for the table view but fetch if user wants to buy more
                isSell,
                netDhvExposure
              );
              const quoteTotal = tFormatUSDC(quote[0].add(quote[2]));

              return quoteTotal >= 0.01 ? quoteTotal : 0;
            };

            const quoteAskCallTotal = await _getQuoteTotal(
              optionSeriesCall,
              callExposure
            );
            const quoteAskPutTotal = await _getQuoteTotal(
              optionSeriesPut,
              putExposure
            );
            const quoteBidCallTotal = await _getQuoteTotal(
              optionSeriesCall,
              callExposure,
              true
            );
            const quoteBidPutTotal = await _getQuoteTotal(
              optionSeriesPut,
              putExposure,
              true
            );

            const localDeltaCall = await calculateOptionDeltaLocally(
              optionSeriesCall,
              toWei((1).toString()),
              false
            );
            const localDeltaPut = await calculateOptionDeltaLocally(
              optionSeriesPut,
              toWei((1).toString()),
              false
            );

            // QUESTION: Calculated on total including fees?
            const ivAskCall = await returnIVFromQuote(
              quoteAskCallTotal,
              optionSeriesCall
            );
            const ivBidCall = await returnIVFromQuote(
              quoteBidCallTotal,
              optionSeriesCall
            );
            const ivAskPut = await returnIVFromQuote(
              quoteAskPutTotal,
              optionSeriesPut
            );
            const ivBidPut = await returnIVFromQuote(
              quoteBidPutTotal,
              optionSeriesPut
            );

            const positions: {
              call: number;
              put: number;
            } = userData?.account?.balances.reduce(
              (
                acc: {
                  call: number;
                  put: number;
                },
                { token, balance }: { token: any; balance: string }
              ) => {
                const matchesExpiry =
                  Number(token.expiryTimestamp) === expiryDate;
                const matchesStrike =
                  BigNumber.from(token.strikePrice)
                    .div(BIG_NUMBER_DECIMALS.OPYN)
                    .mul(BIG_NUMBER_DECIMALS.RYSK)
                    .toString() === strike;

                if (matchesExpiry && matchesStrike && token.isPut) {
                  acc.put = fromOpynToNumber(balance);
                }

                if (matchesExpiry && matchesStrike && !token.isPut) {
                  acc.call = fromOpynToNumber(balance);
                }

                return acc;
              },
              { call: 0, put: 0 }
            );

            return {
              strike: Number(fromWei(strike).toString()),
              call: {
                bid: {
                  IV: toTwoDecimalPlaces(ivBidCall),
                  quote: quoteBidCallTotal,
                  disabled: !callAvailability.isSellable,
                },
                ask: {
                  IV: toTwoDecimalPlaces(ivAskCall),
                  quote: quoteAskCallTotal,
                  disabled: !callAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaCall).toString()),
                pos: positions?.call || 0,
                exposure: callExposure.div(BIG_NUMBER_DECIMALS.RYSK).toNumber(),
              },
              put: {
                bid: {
                  IV: toTwoDecimalPlaces(ivBidPut),
                  quote: quoteBidPutTotal,
                  disabled: !putAvailability.isSellable,
                },
                ask: {
                  IV: toTwoDecimalPlaces(ivAskPut),
                  quote: quoteAskPutTotal,
                  disabled: !putAvailability.isBuyable,
                },
                delta: Number(fromWei(localDeltaPut).toString()),
                pos: positions?.put || 0,
                exposure: putExposure.div(BIG_NUMBER_DECIMALS.RYSK).toNumber(),
              },
            };
          })
        );

        // Might be temp, possibly do this at the graph level
        // once we can get all this data from there?
        const sorted = optionsChainRows.sort((a, b) => a.strike - b.strike);

        dispatch({
          type: OptionsTradingActionType.SET_CHAIN_DATA_FOR_EXPIRY,
          expiry: expiryDate,
          data: sorted,
        });
        setChainRows(sorted);
      };

      fetchPrices().catch((error) => {
        captureException(error);
        console.error(error);
      });
    }
  }, [
    userData,
    ethPrice,
    optionType,
    customOptionStrikes,
    expiryDate,
    portfolioValuesFeed,
  ]);

  return (
    <AnimatePresence mode="wait">
      {chainRows.length ? (
        <motion.table
          className="block bg-bone overflow-x-auto"
          id="options-chain"
          key="chain"
          {...FadeInOut(0.75)}
        >
          <Head />
          <Body chainRows={chainRows} />
        </motion.table>
      ) : (
        <LoadingOrError
          className="border-black"
          error={error}
          extraStrings={[
            "Checking availability...",
            "Calculating exposure...",
            "Computing series...",
            "Fetching quotes...",
            "Determining greeks...",
            "Evaluating IV...",
          ]}
          key="loading"
          // Can remove this once the data is loaded in faster.
          stringSpeed={1500}
        />
      )}
    </AnimatePresence>
  );
};
