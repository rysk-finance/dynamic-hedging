import { useEffect } from "react";
import { load } from "fathom-client";

const useFathom = () => {
  useEffect(() => {
    const fathomKey = process.env.REACT_APP_FATHOM_KEY;

    if (fathomKey) {
      load(fathomKey);
    }
  }, []);
};

export default useFathom;
