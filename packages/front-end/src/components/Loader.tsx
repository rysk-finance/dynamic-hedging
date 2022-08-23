import React from "react";

type LoaderProps = {
  className?: string;
};

export const Loader: React.FC<LoaderProps> = ({ className }) => {
  return <img src="/kite.gif" className={`w-auto ${className}`} />;
};
