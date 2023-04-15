import { useAccount } from "wagmi";
import { gql, useQuery } from "@apollo/client";
import { VaultQueryData } from "../../Shared/types";
import { BigNumber } from "ethers";
import { BIG_NUMBER_DECIMALS } from "src/config/constants";

export const useVaultData = (
  vaultId: string | null
): [BigNumber, BigNumber, string?] => {
  // Global state
  const { address } = useAccount();

  const { data } = useQuery<VaultQueryData>(
    gql`
      query ($vaultId: ID!) {
        vault(id: $vaultId) {
          id
          collateralAmount
          shortAmount
          collateralAsset {
            id
          }
        }
      }
    `,
    {
      variables: {
        vaultId: `${address?.toLowerCase()}-${vaultId}`,
      },
      skip: !vaultId || !address,
    }
  );

  const collateralAmount = BigNumber.from(data?.vault?.collateralAmount || "1");
  const shortAmount = BigNumber.from(data?.vault?.shortAmount || "0");

  const collateralPerOption =
    !collateralAmount.isZero() && !shortAmount.isZero()
      ? collateralAmount.mul(BIG_NUMBER_DECIMALS.OPYN).div(shortAmount)
      : BigNumber.from(0);

  const collateralAsset = data?.vault?.collateralAsset?.id;

  return [collateralAmount, collateralPerOption, collateralAsset];
};
