import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";

import { WETH, USDC, Ether } from "src/Icons";
import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { useGlobalContext } from "src/state/GlobalContext";
import { RyskCountUp } from "src/components/shared/RyskCountUp";

const { Custom } = ConnectButton;

const buttonProps = {
  className: "flex items-center px-4 py-0 h-11 bg-black text-white",
  id: "connect-wallet",
  layout: "position" as const,
  type: "button" as const,
  ...FadeInOutFixedDelay,
};

const Connect = () => {
  const {
    state: { balances, unstoppableDomain },
  } = useGlobalContext();

  const hasBalances = Object.values(balances).some((balance) => balance > 0);

  return (
    <Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
      }) => {
        const connected = account && chain;

        return (
          <AnimatePresence mode="wait">
            {!connected && (
              <motion.button
                onClick={openConnectModal}
                title={`Click to connect your wallet.`}
                key="connect"
                {...buttonProps}
              >
                {`Connect`}
              </motion.button>
            )}

            {connected && chain.unsupported && (
              <motion.button
                onClick={openChainModal}
                title={`Click to switch networks.`}
                key="unsupported"
                {...buttonProps}
              >
                {`Wrong network`}
              </motion.button>
            )}

            {connected && !chain.unsupported && (
              <>
                {hasBalances && (
                  <motion.div
                    className="hidden xl:flex items-center justify-center h-11 bg-black text-white mr-1 px-4"
                    key="balances"
                    layout="position"
                    {...FadeInOutFixedDelay}
                  >
                    <span className="flex items-center">
                      <WETH className="w-5 h-5 mr-1" />
                      <p className="mr-2 pr-2 border-r border-white">
                        <RyskCountUp value={balances.WETH} />
                      </p>
                    </span>
                    <span className="flex items-center">
                      <USDC className="w-5 h-5 mr-1" />
                      <p className="mr-2 pr-2 border-r border-white">
                        <RyskCountUp value={balances.USDC} />
                      </p>
                    </span>
                    <span className="flex items-center">
                      <div className="flex items-center justify-center w-5 h-5 mr-1 bg-white rounded-full">
                        <Ether className="w-4 h-4" />
                      </div>
                      <p>
                        <RyskCountUp value={balances.ETH} />
                      </p>
                    </span>
                  </motion.div>
                )}

                <motion.button
                  onClick={openAccountModal}
                  title={`Connected to ${chain.name}.`}
                  key="connected"
                  {...buttonProps}
                >
                  {chain.iconUrl && (
                    <img
                      alt={chain.name ?? "Chain icon"}
                      src={chain.iconUrl}
                      className="w-4 h-4 m-0 mr-2"
                    />
                  )}
                  {unstoppableDomain || account.ensName || account.displayName}
                </motion.button>
              </>
            )}
          </AnimatePresence>
        );
      }}
    </Custom>
  );
};

export { Connect };
