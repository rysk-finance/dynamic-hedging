import { useProvider } from "wagmi";
import { getContractAddress } from "../../utils/helpers";
import { OptionExchangeABI } from "../../abis/OptionExchange_ABI";
import { BigNumber, ethers } from "ethers";

/**
 * @author Yassine
 * @title Hook:  OToken
 * @notice It allows to read OToken address
 * @dev The OToken is not created here as this is a static call
 */
const useOToken = () => {
  // Global state
  const provider = useProvider();

  // Addresses
  const optionExchangeAddress = getContractAddress("optionExchange");
  const usdcAddress = getContractAddress("USDC");
  const wethAddress = getContractAddress("WETH");
  const strikeAsset = usdcAddress;
  const underlying = wethAddress;
  const collateral = usdcAddress;

  // Contracts
  const optionExchange = new ethers.Contract(
    optionExchangeAddress,
    OptionExchangeABI,
    provider
  );

  // Contract read
  const getOToken = async (
    expiration: string,
    strike: BigNumber,
    isPut: boolean
  ) => {
    return optionExchange.callStatic.createOtoken({
      strikeAsset,
      collateral,
      underlying,
      expiration: expiration,
      strike: strike,
      isPut: isPut,
    });
  };

  return [
    getOToken, // retrieve oToken address
  ];
};

export default useOToken;
