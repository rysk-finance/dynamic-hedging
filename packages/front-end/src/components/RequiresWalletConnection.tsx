import type { PropsWithChildren, ReactElement } from "react";

import { useCallback } from "react";
import { useAccount, useConnect } from "wagmi";

import { useGlobalContext } from "../state/GlobalContext";
import { ActionType } from "../state/types";
import { Button } from "./shared/Button";

type RequiresWalletConnectionProps = {
  className?: string;
  fallbackComponent?: ReactElement;
};

export const RequiresWalletConnection = ({
  className,
  fallbackComponent,
  children,
}: PropsWithChildren<RequiresWalletConnectionProps>) => {
  const { isConnected, isDisconnected } = useAccount();
  const { connect, connectors } = useConnect();

  const { dispatch } = useGlobalContext();

  // Replace with rainbow-kit button.
  const connector = connectors[0];

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

  if (isConnected && children) {
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
    <Button
      onClick={() => {
        if (isDisconnected) {
          connect({ connector });
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      color="black"
      className={`${className}`}
    ></Button>
  );
};
