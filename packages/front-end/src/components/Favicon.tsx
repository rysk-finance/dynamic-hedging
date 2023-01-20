import { useAccount } from "wagmi";
import { Helmet } from "react-helmet";

const Favicon = () => {
  const { isConnected } = useAccount();

  return (
    <Helmet>
      <link
        rel="icon"
        type="image/png"
        href={isConnected ? "favicon.ico" : "favicon_disconnected.ico"}
      />
    </Helmet>
  );
};

export default Favicon;
