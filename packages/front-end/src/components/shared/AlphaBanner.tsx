import React from "react";

import { DHV_NAME } from "../../config/constants"

export const AlphaBanner = () => {

  return (
    <>
      <p className="text-center text-lg mt-16 font-medium">
        {DHV_NAME} has not traded any options yet. First options trades will be executed the week starting October 2nd.
      </p>
    </>
  );

}