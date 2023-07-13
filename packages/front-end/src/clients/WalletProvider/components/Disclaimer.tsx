import type { DisclaimerComponent } from "@rainbow-me/rainbowkit";

import { TERMS_LINK, PP_LINK } from "src/config/links";

const Disclaimer: DisclaimerComponent = ({ Text, Link }) => {
  return (
    <Text>
      {`You have read and understand, and do hereby agree to the `}
      <Link href={TERMS_LINK}>
        <small className="text-xs text-cyan-dark-compliant">{`Rysk user terms of service`}</small>
      </Link>
      {` and acknowledge that you have read and understand the `}
      <Link href={PP_LINK}>
        <small className="text-xs text-cyan-dark-compliant">{`Rysk privacy policy.`}</small>
      </Link>
    </Text>
  );
};

export default Disclaimer;
