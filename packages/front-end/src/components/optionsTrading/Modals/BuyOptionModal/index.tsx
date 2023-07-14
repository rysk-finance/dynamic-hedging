import { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { readContract } from "@wagmi/core";
import { OptionExchangeABI } from "src/abis/OptionExchange_ABI";
import { erc20ABI } from "src/abis/erc20_ABI";
import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { buy } from "src/components/shared/utils/transactions/buy";
import { ZERO_ADDRESS } from "src/config/constants";
import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";
import { toOpyn, toRysk, toUSDC, toWei } from "src/utils/conversion-helper";
import { getContractAddress } from "src/utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { Pricing } from "./components/Pricing";
import { useBuyOption } from "./hooks/useBuyOption";

export const BuyOptionModal = () => {
  const {
    state: {
      geoData: { blocked },
      options: { activeExpiry, refresh },
      selectedOption,
    },
    dispatch,
  } = useGlobalContext();

  const [amountToBuy, setAmountToBuy] = useState("");
  const [debouncedAmountToBuy] = useDebounce(amountToBuy, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useBuyOption(debouncedAmountToBuy);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const amount = event.currentTarget.value;
    const decimals = amount.split(".");
    const rounded =
      decimals.length > 1
        ? `${decimals[0]}.${decimals[1].slice(0, 2)}`
        : event.currentTarget.value;

    setAmountToBuy(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user) {
        const amount = toUSDC(positionData.requiredApproval);

        const hash = await approveAllowance(
          addresses.exchange,
          addresses.token,
          amount
        );

        if (hash) {
          setAllowance({ approved: true, amount });
          setTransactionPending(false);
          notifyApprovalSuccess(hash);
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const handleBuy = async () => {
    setTransactionPending(true);

    try {
      if (addresses.token && addresses.user && selectedOption) {
        const amount = toRysk(amountToBuy);
        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: toWei(selectedOption.strikeOptions.strike.toString()),
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: addresses.token,
          underlying: getContractAddress("WETH"),
          collateral: addresses.token,
        };

        // check weth collateralised optionSeries
        const optionDetails = await readContract({
          address: addresses.exchange,
          abi: OptionExchangeABI,
          functionName: "getOptionDetails",
          args: [
            ZERO_ADDRESS,
            { ...optionSeries, collateral: getContractAddress("WETH") },
          ],
        });

        // check if exchange has optionSeries
        const optionExchangeAmount = await readContract({
          address: optionDetails[0],
          abi: erc20ABI,
          functionName: "balanceOf",
          args: [addresses.exchange],
        });

        // if exchange optionSeries covers amount, use weth as collateral
        if (BigNumber.from(optionExchangeAmount).gte(toOpyn(amountToBuy))) {
          optionSeries.collateral = getContractAddress("WETH");
        }

        const hash = await buy(
          positionData.acceptablePremium,
          amount,
          addresses.exchange,
          optionSeries,
          refresh,
          addresses.user
        );

        if (hash) {
          setTransactionPending(false);
          handleTransactionSuccess(hash, "Purchase");
        }
      }
    } catch (error) {
      setTransactionPending(false);
      notifyFailure(error);
    }
  };

  const disableChangeButton = useMemo(() => {
    const isPut = selectedOption?.callOrPut === "put";

    if (selectedOption && isPut && selectedOption.strikeOptions.put) {
      const sellData = selectedOption.strikeOptions.put.sell;

      return sellData.disabled || !sellData.quote.total;
    }

    if (selectedOption && !isPut && selectedOption.strikeOptions.call) {
      const sellData = selectedOption.strikeOptions.call.sell;

      return sellData.disabled || !sellData.quote.total;
    } else {
      return true;
    }
  }, [selectedOption]);



  return (
    <Modal>
      <Header
        changeVisible={!disableChangeButton}
      >
        {`Buy Position`}
      </Header>

      <Pricing positionData={positionData} />

      <Wrapper>
        <Label
          title="Enter how many contracts you would like to buy."
        >
          <Input
            name="buy-amount"
            onChange={handleChange}
            placeholder="How many would you like to buy?"
            value={amountToBuy}
          />
        </Label>

        <Button
          className="w-1/4 !border-0"
          disabled={
            !Number(amountToBuy) ||
            !addresses.user ||
            positionData.remainingBalance < 0 ||
            transactionPending ||
            loading ||
            blocked
          }
          {...getButtonProps(
            "buy",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleBuy
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to make a trade using your USDC balance to pay for the options premium and fees. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
