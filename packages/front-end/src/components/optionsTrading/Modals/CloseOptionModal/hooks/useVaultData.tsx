import { useAccount } from "wagmi";
import { gql, useQuery } from "@apollo/client";
import { VaultQueryData } from "../../Shared/types";
import { BigNumber } from "ethers";
import { fromOpynToNumber } from "src/utils/conversion-helper";

export const useVaultData = (vaultId: string | null) => {
  // Global state
  const { address } = useAccount();

  const { data } = useQuery<VaultQueryData>(
    gql`
      query ($vaultId: ID!) {
        vault(id: $vaultId) {
          id
          collateralAmount
          shortAmount
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

  const collateralAmount = BigNumber.from(data?.vault?.collateralAmount || 0);

  const collateralPerOption = collateralAmount.gt(0)
    ? collateralAmount.div(fromOpynToNumber(data?.vault?.shortAmount || 1))
    : BigNumber.from(0);

  return [collateralAmount, collateralPerOption];
};
