import { ConnectButton } from "@rainbow-me/rainbowkit";

const { Custom } = ConnectButton;

const buttonStyles = `flex items-center px-4 py-0 h-11 bg-black text-white`;

const Connect = () => {
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
          <>
            {!connected && (
              <button
                onClick={openConnectModal}
                className={buttonStyles}
                title={`Click to connect your wallet.`}
                type="button"
              >
                {`Connect`}
              </button>
            )}

            {connected && chain.unsupported && (
              <button
                onClick={openChainModal}
                className={buttonStyles}
                title={`Click to switch networks.`}
                type="button"
              >
                {`Wrong network`}
              </button>
            )}

            {connected && !chain.unsupported && (
              <button
                onClick={openAccountModal}
                className={buttonStyles}
                title={`Connected to ${chain.name}.`}
                type="button"
              >
                {chain.iconUrl && (
                  <img
                    alt={chain.name ?? "Chain icon"}
                    src={chain.iconUrl}
                    className="w-4 h-4 m-0 mr-2"
                  />
                )}
                {account.ensName ?? account.displayName}
              </button>
            )}
          </>
        );
      }}
    </Custom>
  );
};

export { Connect };
