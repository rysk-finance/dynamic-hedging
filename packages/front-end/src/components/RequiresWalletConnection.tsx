import React, { useCallback } from "react";
import { useWalletContext } from "../App";
import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";

type RequiresWalletConnectionProps = {
  className?: string;
  fallbackComponent?: React.ReactElement;
};

export const RequiresWalletConnection: React.FC<
  RequiresWalletConnectionProps
> = ({ className, fallbackComponent, children }) => {
  const { dispatch } = useGlobalContext();
  const { account, connectWallet } = useWalletContext();

  const handleMouseEnter = useCallback(() => {
    dispatch({
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
      isActive: true,
    });
  }, [dispatch]);

  const handleMouseLeave = useCallback(() => {
    dispatch({
      type: ActionType.SET_CONNECT_WALLET_INDICATOR_IS_ACTIVE,
      isActive: false,
    });
  }, [dispatch]);

  if (account) {
    return <>{children}</>;
  }

  if (fallbackComponent) {
    return (
      <div
        className="w-full h-full"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {fallbackComponent}
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        connectWallet?.();
      }}
      className={`border-2 border-black bg-yellow-500 w-full h-full cursor-pointer ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    ></div>
  );
};
