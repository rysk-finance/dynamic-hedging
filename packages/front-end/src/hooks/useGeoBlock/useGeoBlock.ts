import type { GeoData } from "src/state/types";

import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";
import { ActionType } from "src/state/types";

const checkGeoLocation = async () => {
  const geoBlockDisabled = Boolean(process.env.REACT_APP_GEO_BLOCK_DISABLED);

  if (geoBlockDisabled) {
    return { blocked: false } as GeoData;
  }

  try {
    const response = await fetch("https://www.rysk.finance/api/geo-block/");
    const data: GeoData = await response.json();

    return data;
  } catch (error) {
    return { blocked: true } as GeoData;
  }
};

export const useGeoBlock = () => {
  const { dispatch } = useGlobalContext();

  useEffect(() => {
    checkGeoLocation().then((geoData) => {
      dispatch({ type: ActionType.SET_USER_GEO_DATA, geoData });
    });
  }, []);
};
