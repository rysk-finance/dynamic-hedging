import React from "react";

import { DHV_NAME } from "../../config/constants";

export const AlphaBanner = () => {
  return (
    <div className="p-2 text-white bg-black">
      <p className="text-center text-md font-medium">
        {DHV_NAME} has not traded any options yet. First options trades will be
        executed the week starting October 2nd.
      </p>
    </div>
  );
};
