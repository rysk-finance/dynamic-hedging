import { TransactionResponse } from "@ethersproject/abstract-provider";
import * as ethers from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useWalletContext } from "../App";
import addresses from "../contracts.json";
import { ContractAddresses, ETHNetwork } from "../types";

type EventName = string;
type EventData = any[];

type EventHandler<T extends EventData> = (...args: T) => void;

type EventHandlerMap<T extends Record<EventName, EventData>> = {
  [event in keyof T]: EventHandler<T[event]>;
};

type IsListeningMap<T extends Partial<Record<EventName, EventData>>> = {
  [event in keyof T]: boolean;
};

type useContractRyskContractArgs<T extends Record<EventName, EventData>> = {
  contract: keyof ContractAddresses;
  ABI: ethers.ContractInterface;
  readOnly?: boolean;
  events?: EventHandlerMap<T>;
  isListening?: IsListeningMap<T>;
};

type useContractExternalContractArgs<T extends Record<EventName, EventData>> = {
  contractAddress: string;
  ABI: ethers.ContractInterface;
  readOnly?: boolean;
  events?: EventHandlerMap<T>;
  isListening?: IsListeningMap<T>;
};

type useContractArgs<T extends Record<EventName, EventData>> =
  | useContractRyskContractArgs<T>
  | useContractExternalContractArgs<T>;

/**
 *
 * @param args
 * @returns
 */
export const useContract = <T extends Record<EventName, EventData> = any>(
  args: useContractArgs<T>
) => {
  const [network] = useState(
    process.env.REACT_APP_NETWORK as keyof typeof addresses | undefined
  );
  const { provider } = useWalletContext();
  const [ethersContract, setEthersContract] = useState<ethers.Contract | null>(
    null
  );

  // Store events in state on init, to avoid re-adding event handlers
  // when reference changes on re-renders.
  const [contractEvents] = useState(() => args.events);

  const callWithErrorHandling = useCallback(
    async ({
      method,
      args,
      successMessage: successMessage = "✅ Transaction created",
      onComplete,
      onFail,
    }: {
      method: ethers.ContractFunction;
      args: any[];
      successMessage?: string;
      onComplete?: () => void;
      onFail?: () => void;
    }) => {
      try {
        const transaction = (await method(...args)) as TransactionResponse;
        await transaction.wait();
        toast(successMessage);
        onComplete?.();
        return;
      } catch (err) {
        try {
          // Might need to modify this is errors other than RPC errors are being thrown
          // my contract function calls.
          toast(`❌ ${(err as any).data.message}`, {
            autoClose: 5000,
          });
          onFail?.();
          return null;
        } catch {
          toast(JSON.stringify(err));
          onFail?.();
          return null;
        }
      }
    },
    []
  );

  useEffect(() => {
    const signerOrProvider = args.readOnly ? provider : provider?.getSigner();
    if (signerOrProvider && network && !ethersContract) {
      const address =
        "contract" in args
          ? (addresses as Record<ETHNetwork, ContractAddresses>)[network][
              (args as useContractRyskContractArgs<T>).contract
            ]
          : (args as useContractExternalContractArgs<T>).contractAddress;
      setEthersContract(
        new ethers.Contract(address, args.ABI, signerOrProvider)
      );
    }
  }, [args, provider, network, ethersContract]);

  // Takes the handlers map and creates an updated map where the handler
  // is wrapped in an if statement that checks whether the isListening values
  // is true (or if it's not present, in which case we assume true).
  const updatedHandlers = useMemo(() => {
    const handlers: Partial<EventHandlerMap<T>> = {};

    if (contractEvents) {
      const eventNames = Object.keys(
        contractEvents
      ) as (keyof EventHandlerMap<T>)[];
      eventNames.forEach((eventName) => {
        const updatedHandler: EventHandlerMap<T>[typeof eventName] = (
          ...handlerArgs
        ) => {
          const shouldRunHandler =
            !args.isListening ||
            !args.isListening[eventName] ||
            (args.isListening && args.isListening[eventName]);
          if (shouldRunHandler) {
            const handler = contractEvents[eventName];
            handler(...handlerArgs);
          }
        };
        handlers[eventName] = updatedHandler;
      });
    }

    return handlers;
  }, [args.isListening, contractEvents]);

  // Attaches and removes the handlers as isListening map changes.
  useEffect(() => {
    if (ethersContract && updatedHandlers) {
      const eventNames = Object.keys(
        updatedHandlers
      ) as (keyof EventHandlerMap<T>)[];

      eventNames.forEach((eventName) => {
        const handler = updatedHandlers[eventName];
        // Need to do this check as we instanced handlers as a Partial in the Memo above.
        // Should always be true.
        if (handler) {
          // @ts-ignore - unable to tell ethers that this handler
          // takes specific args, and not just any[]
          ethersContract.on(eventName as string, handler);
        }
      });
    }

    return () => {
      if (ethersContract && updatedHandlers) {
        const eventNames = Object.keys(
          updatedHandlers
        ) as (keyof EventHandlerMap<T>)[];

        eventNames.forEach((eventName) => {
          const handler = updatedHandlers[eventName];
          if (handler) {
            // @ts-ignore - same as above where we're adding the listener.
            ethersContract.off(eventName as string, handler);
          }
        });
      }
    };
  }, [updatedHandlers, ethersContract]);

  return [ethersContract, callWithErrorHandling] as const;
};
