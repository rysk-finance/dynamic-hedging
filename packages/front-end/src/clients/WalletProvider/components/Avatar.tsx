import type { AvatarComponent } from "@rainbow-me/rainbowkit";

import { hexToCSSFilter } from "hex-to-css-filter";
import { useEffect } from "react";

import { useGlobalContext } from "src/state/GlobalContext";

const CustomAvatar: AvatarComponent = ({ address, ensImage, size }) => {
  const {
    state: { unstoppableDomain },
  } = useGlobalContext();

  const borderRadius = size / 2;
  const iconSize = size * 0.65;

  const addressToColor = `#${address.slice(2, 8)}`;
  const colorToCSS = hexToCSSFilter(addressToColor).filter.slice(0, -1);

  // Using this anti-pattern hack until RainbowKit provides
  // a way to customise the profile name in the modal.
  useEffect(() => {
    const profile = document.getElementById("rk_profile_title");

    if (unstoppableDomain && profile) {
      profile.innerHTML = unstoppableDomain;
    }
  }, [unstoppableDomain]);

  return ensImage ? (
    <img
      alt="Your ENS avatar."
      src={ensImage}
      width={size}
      height={size}
      style={{ borderRadius }}
    />
  ) : (
    <div
      className="flex justify-center items-center bg-bone"
      style={{
        borderRadius,
        height: size,
        width: size,
      }}
    >
      <img
        src="./kite-black.gif"
        width={iconSize}
        height={iconSize}
        alt="Rysk rotating logo."
        style={{
          filter: colorToCSS,
        }}
      />
    </div>
  );
};

export default CustomAvatar;
