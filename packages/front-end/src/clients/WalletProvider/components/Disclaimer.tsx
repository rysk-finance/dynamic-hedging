import type { DisclaimerComponent } from "@rainbow-me/rainbowkit";

const Disclaimer: DisclaimerComponent = ({ Text, Link }) => {
  return (
    <Text>
      {`You have read and understand, and do hereby agree to the `}
      <Link href="https://docs.rysk.finance/terms-of-service">
        <small className="text-xs text-cyan-dark">{`Rysk Alpha User Terms of Service`}</small>
      </Link>
      {` and acknowledge that you have read and understand the `}
      <Link href="https://docs.rysk.finance/privacy-policy">
        <small className="text-xs text-cyan-dark">{`Rysk Alpha Privacy Policy.`}</small>
      </Link>
    </Text>
  );
};

export default Disclaimer;
