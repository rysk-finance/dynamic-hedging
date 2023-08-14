import { useGlobalContext } from "src/state/GlobalContext";

export const CollateralString = () => {
  const {
    state: { collateralPreferences },
  } = useGlobalContext();

  return (
    <small className="flex leading-6 border-gray-600 border-b">
      {`Using ${collateralPreferences.type} to ${
        collateralPreferences.full
          ? "fully collateralise your position."
          : ` provide ${
              collateralPreferences.amount || 0
            }x the minimum required collateral.`
      }`}
    </small>
  );
};
