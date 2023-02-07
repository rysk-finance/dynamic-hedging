type LoaderProps = {
  className?: string;
};

export const Loader = ({ className }: LoaderProps) => {
  return <img src="/kite.gif" className={`w-auto ${className}`} />;
};
