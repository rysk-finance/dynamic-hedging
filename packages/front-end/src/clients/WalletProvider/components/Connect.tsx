import { ConnectButton } from "@rainbow-me/rainbowkit";
import { AnimatePresence, motion } from "framer-motion";

import FadeInOutFixedDelay from "src/animation/FadeInOutFixedDelay";
import { useGlobalContext } from "src/state/GlobalContext";

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
    state: { unstoppableDomain },
  } = useGlobalContext();

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
            )}
          </AnimatePresence>
        );
      }}
    </Custom>
  );
};

export { Connect };
