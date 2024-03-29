import type { ChangeEvent } from "react";

import { BigNumber } from "ethers";
import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";

import { approveAllowance } from "src/components/shared/utils/transactions/approveAllowance";
import { sell } from "src/components/shared/utils/transactions/sell";
import { useGlobalContext } from "src/state/GlobalContext";
import { Convert } from "src/utils/Convert";
import { getContractAddress } from "src/utils/helpers";
import { useNotifications } from "../../hooks/useNotifications";
import { Disclaimer } from "../Shared/components/Disclaimer";
import { Button, Input, Label, Wrapper } from "../Shared/components/Form";
import { Header } from "../Shared/components/Header";
import { Modal } from "../Shared/components/Modal";
import { Symbol } from "../Shared/components/Symbol";
import { MAX_TRADE_SIZE, MIN_TRADE_SIZE } from "../Shared/utils/constants";
import { getButtonProps } from "../Shared/utils/getButtonProps";
import { roundInputValue } from "../Shared/utils/roundNumberValue";
import { Filters } from "./components/Filters";
import { Pricing } from "./components/Pricing";
import { useSellOption } from "./hooks/useSellOption";

export const SellOptionModal = () => {
  const {
    state: {
      collateralPreferences,
      geoData: { blocked },
      options: { activeExpiry, refresh },
      selectedOption,
      userTradingPreferences: { approvals },
    },
  } = useGlobalContext();

  const [amountToSell, setAmountToSell] = useState("");
  const [debouncedAmountToSell] = useDebounce(amountToSell, 300);
  const [transactionPending, setTransactionPending] = useState(false);

  const [addresses, allowance, setAllowance, positionData, loading] =
    useSellOption(debouncedAmountToSell);

  const [notifyApprovalSuccess, handleTransactionSuccess, notifyFailure] =
    useNotifications();

  const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rounded = roundInputValue(event);

    setAmountToSell(rounded);
  };

  const handleApprove = async () => {
    setTransactionPending(true);

    try {
      if (addresses.collateral && addresses.user) {
        const amount =
          collateralPreferences.type === "USDC"
            ? Convert.fromStr(positionData.requiredApproval).toUSDC()
            : Convert.fromStr(positionData.requiredApproval).toWei();

        const hash = await approveAllowance(
          addresses.exchange,
          addresses.collateral,
          amount,
          approvals
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

  const handleSell = async () => {
    setTransactionPending(true);

    try {
      if (
        addresses.collateral &&
        addresses.token &&
        addresses.user &&
        selectedOption
      ) {
        const optionSeries = {
          expiration: BigNumber.from(activeExpiry),
          strike: Convert.fromInt(selectedOption.strikeOptions.strike).toWei(),
          isPut: selectedOption.callOrPut === "put",
          strikeAsset: getContractAddress("USDC"),
          underlying: getContractAddress("WETH"),
          collateral: addresses.collateral,
        };

        const hash = await sell(
          positionData.acceptablePremium,
          Convert.fromStr(amountToSell).toWei(),
          collateralPreferences.type === "USDC"
            ? Convert.fromInt(positionData.collateral).toUSDC()
            : Convert.fromInt(positionData.collateral).toWei(),
          addresses.collateral,
          addresses.exchange,
          optionSeries,
          addresses.token,
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
      const buyData = selectedOption.strikeOptions.put.buy;

      return buyData.disabled || !buyData.quote.total;
    }

    if (selectedOption && !isPut && selectedOption.strikeOptions.call) {
      const buyData = selectedOption.strikeOptions.call.buy;

      return buyData.disabled || !buyData.quote.total;
    } else {
      return true;
    }
  }, [selectedOption]);

  return (
    <Modal>
      <Header changeVisible={!disableChangeButton}>{`Sell Position`}</Header>

      <div className="flex flex-col">
        <Symbol {...positionData} />

        <Filters />

        <Pricing
          loading={loading}
          positionData={positionData}
          size={amountToSell}
        />
      </div>

      <Wrapper>
        <Label title="Enter how many contracts you would like to sell.">
          <Input
            name="sell-amount"
            onChange={handleAmountChange}
            placeholder="How many would you like to sell?"
            value={amountToSell}
          />
        </Label>

        <Button
          disabled={
            !Number(amountToSell) ||
            Number(amountToSell) < MIN_TRADE_SIZE ||
            Number(amountToSell) > MAX_TRADE_SIZE ||
            (collateralPreferences.type === "USDC" &&
              positionData.remainingBalanceUSDC <= 0) ||
            (collateralPreferences.type === "WETH" &&
              positionData.remainingBalanceWETH <= 0) ||
            (!collateralPreferences.full &&
              collateralPreferences.amount < 1.1) ||
            !positionData.hasRequiredCapital ||
            transactionPending ||
            loading ||
            blocked
          }
          {...getButtonProps(
            "sell",
            transactionPending || loading,
            allowance.approved,
            handleApprove,
            handleSell
          )}
        />
      </Wrapper>

      <Disclaimer>
        {`You are about to make a trade using your balance to collateralise the options and receive a USDC premium for the trade. Please ensure this is what you want because the action is irreversible.`}
      </Disclaimer>
    </Modal>
  );
};
